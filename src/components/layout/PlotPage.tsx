import { useEffect, useMemo, useRef, useState } from 'react'
import { downloadBlob, toExternalConfig } from '../../utils/configIo'
import type { PlotConfig } from '../../config/defaultPlotConfig'
import { Alert } from '../ui/alert'
import { dataframeLabel, getSourceMode } from '../../utils/appState'
import { Button } from '../ui/button'
import { useI18n, type Translate } from '../../uiTranslations'
import { BackendError, fetchBackend, readBackendError, toErrorDetails, type BackendErrorDetails } from '../../utils/backendErrors'
import { addLogEntry } from '../../utils/debugLog'
import { attributionHeaders, useAttributionUnlocked } from '../../utils/attributionKey'
import { getCachedDatasourceFile, readDatasourceWithFallback } from '../../utils/datasourceStorage'
import { ErrorDetails } from './DebugLog'
import type { SettingsSectionId } from '../../config/settingsSections'
import type { MissingSetting } from '../../utils/settingsStatus'

interface Props {
  plotConfig: PlotConfig
  configBaseName: string
  activeDataframeIndex: number
  activeFrameIndex: number
  plotAction: 'preview-current' | 'create-all'
  plotActionNonce: number
  datasourceFilesByDataframe: Record<number, File>
  availableDatasets: string[] | null
  /** Required settings the active plot is missing; it is not rendered while any are listed. */
  missing: MissingSetting[]
  onJump: (section: SettingsSectionId, anchor?: string) => void
  autoRefresh: boolean
  onAutoRefreshChange: (next: boolean) => void
}
interface RenderedPlotEntry {
  dataframeIndex: number
  frameIndex: number
  url: string
  blob: Blob
  mediaType: string
}

function parseBackendMessages(headerValue: string | null): string[] {
  if (!headerValue) {
    return []
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(headerValue)) as unknown
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : []
  } catch {
    return []
  }
}

type PlotRequestPayload = {
  config: unknown
  dataframe_index?: number
  frame_index?: number
  include_log?: boolean
  /** Id for polling /api/render-status/{request_id} while the plot renders. */
  request_id?: string
  plots?: Array<{ dataframe_index: number; frame_index: number }>
}

/** Successful render with `include_log`: the image as base64 plus the plot output. */
type RenderPlotResponse = { image: string; media_type: string; messages?: string[]; log?: string }

function base64ToBlob(base64: string, mediaType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mediaType })
}

/** A datasource file must be readable within this time, otherwise the render stops with a message. */
const FILE_READ_TIMEOUT_MS = 15_000

/**
 * Reads a datasource file into memory before it is sent. Uploading an unreadable file directly
 * can leave the request hanging in the browser without ever reaching the backend. If the file
 * cannot be read, the copy in browser storage is used; if that fails too, the render stops with a
 * clear message.
 */
async function readDatasourceFile(file: File, t: Translate): Promise<File> {
  try {
    return await readDatasourceWithFallback(file, () => getCachedDatasourceFile(file.name), FILE_READ_TIMEOUT_MS)
  } catch (error) {
    throw new BackendError({
      message: t('datasourceUnreadable', { name: file.name }),
      messages: [],
      log: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    })
  }
}

async function buildPlotRequest(
  payload: PlotRequestPayload,
  plotConfig: PlotConfig,
  datasourceFilesByDataframe: Record<number, File>,
  availableDatasets: string[] | null,
  dataframeIndices: number[],
  t: Translate,
): Promise<RequestInit> {
  const uniqueIndices = [...new Set(dataframeIndices)]
  const missingDataframes = uniqueIndices.filter((dataframeIndex) => {
    const dataframe = plotConfig.dataframes[dataframeIndex]
    return getSourceMode(dataframe ?? plotConfig.dataframes[0], availableDatasets ?? []) === 'file' && Boolean(dataframe?.importFileName) && datasourceFilesByDataframe[dataframeIndex]?.name !== dataframe.importFileName
  })
  if (missingDataframes.length > 0) {
    throw new BackendError({ message: t('reuploadDatasource', { list: missingDataframes.map((index) => index + 1).join(', ') }), messages: [] })
  }

  const datasourceIndices = uniqueIndices.filter((dataframeIndex) => {
    const dataframe = plotConfig.dataframes[dataframeIndex]
    const file = datasourceFilesByDataframe[dataframeIndex]
    return Boolean(file) && (!dataframe?.importFileName || file.name === dataframe.importFileName)
  })
  if (datasourceIndices.length === 0) {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...attributionHeaders() },
      body: JSON.stringify(payload),
    }
  }

  const form = new FormData()
  const descriptors = []
  for (const dataframeIndex of datasourceIndices) {
    const fileField = `datasource_${dataframeIndex}`
    const file = await readDatasourceFile(datasourceFilesByDataframe[dataframeIndex], t)
    form.append(fileField, file)
    descriptors.push({
      dataframe_index: dataframeIndex,
      kind: 'xlsx',
      file_field: fileField,
      filename: file.name,
    })
  }
  form.append('payload', JSON.stringify(payload))
  form.append('data_sources', JSON.stringify(descriptors))

  return {
    method: 'POST',
    headers: attributionHeaders(),
    body: form,
  }
}

type BatchFailure = { dataframeIndex: number; frameIndex: number; details: BackendErrorDetails }
type PageError = { title: string; details: BackendErrorDetails }

/** A render request is cancelled after this long, with the last known backend state. */
const RENDER_TIMEOUT_MS = 120_000
/** From here on the progress box points out that the render takes unusually long. */
const SLOW_RENDER_SECONDS = 20
const STATUS_POLL_MS = 1000

/** Live state of a render, from /api/render-status/{id}. */
type RenderStatus = {
  state: 'queued' | 'running'
  elapsedSeconds: number
  location: string
  waitingIn: string
  queuedRenders: number
  outputTail: string[]
}
type RenderProgressState = {
  id: string
  label: string
  startedAt: number
  status: RenderStatus | null
  /** The backend did not answer the last status request. */
  statusUnavailable: boolean
  /** The backend answers status requests but has never seen this render: the request is stuck in the browser. */
  notReceived: boolean
}

/** Status answers of "unknown" before the render is considered not received by the backend. */
const NOT_RECEIVED_AFTER_POLLS = 3

const parseRenderStatus = (payload: Record<string, unknown>): RenderStatus | null =>
  payload.state === 'queued' || payload.state === 'running'
    ? {
      state: payload.state,
      elapsedSeconds: typeof payload.elapsed_seconds === 'number' ? payload.elapsed_seconds : 0,
      location: typeof payload.location === 'string' ? payload.location : '',
      waitingIn: typeof payload.waiting_in === 'string' ? payload.waiting_in : '',
      queuedRenders: typeof payload.queued_renders === 'number' ? payload.queued_renders : 0,
      outputTail: Array.isArray(payload.output_tail) ? payload.output_tail.filter((line): line is string => typeof line === 'string') : [],
    }
    : null

/**
 * Polls the backend for the progress of render `id` until the returned stop function is called.
 * `'unknown'`: the backend has no render with this id (not received yet, or already finished);
 * `null`: the backend did not answer the status request.
 */
function pollRenderStatus(id: string, onStatus: (status: RenderStatus | 'unknown' | null) => void): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout>
  const poll = async () => {
    try {
      const response = await fetch(`/api/render-status/${encodeURIComponent(id)}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
      if (!stopped && response.status === 404) onStatus('unknown')
      if (!stopped && response.ok) {
        const status = parseRenderStatus(await response.json() as Record<string, unknown>)
        if (status) onStatus(status)
      }
    } catch {
      if (!stopped) onStatus(null)
    }
    if (!stopped) timer = setTimeout(poll, STATUS_POLL_MS)
  }
  timer = setTimeout(poll, STATUS_POLL_MS)
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}

function RenderProgressBox({ progress }: { progress: RenderProgressState }) {
  const { t } = useI18n()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])
  const elapsedSeconds = Math.max(0, Math.round((now - progress.startedAt) / 1000))
  const { status } = progress
  const lastOutput = status?.outputTail.at(-1)

  return (
    <div role="status" className="grid gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <strong>{t('renderingPlotLabel', { plot: progress.label })}</strong>
        <span className="tabular-nums text-zinc-500">{t('elapsedSeconds', { seconds: elapsedSeconds })}</span>
      </div>
      {status?.state === 'queued' ? <p className="m-0 text-xs">{t('renderQueued', { count: Math.max(1, status.queuedRenders) })}</p> : null}
      {status?.location ? <p className="m-0 text-xs"><span className="font-semibold">{t('backendAt')}:</span> <code className="break-all">{status.location}</code></p> : null}
      {status?.waitingIn ? <p className="m-0 text-xs"><span className="font-semibold">{t('backendWaitingIn')}:</span> <code className="break-all">{status.waitingIn}</code></p> : null}
      {lastOutput ? <p className="m-0 text-xs"><span className="font-semibold">{t('lastOutput')}:</span> <code className="break-all">{lastOutput}</code></p> : null}
      {progress.statusUnavailable ? <p className="m-0 text-xs text-amber-700 dark:text-amber-400">{t('statusUnavailable')}</p> : null}
      {progress.notReceived ? <p className="m-0 text-xs text-amber-700 dark:text-amber-400">{t('renderNotReceived')}</p> : null}
      {elapsedSeconds >= SLOW_RENDER_SECONDS ? <p className="m-0 text-xs text-amber-700 dark:text-amber-400">{t('renderSlow', { seconds: RENDER_TIMEOUT_MS / 1000 })}</p> : null}
    </div>
  )
}

/** Waits this long after the last config change before the preview renders again. */
const AUTO_REFRESH_DELAY_MS = 1200

type PreviewStatus = 'idle' | 'loading' | 'ok' | 'error' | 'stale'

/**
 * Preview next to the settings: renders the active plot (again after changes when auto-refresh is
 * on), runs "Generate all" and offers the downloads. Plots with missing required settings are not
 * sent to the backend; the missing settings are listed with links to them instead.
 */
export function PlotPage({ plotConfig, configBaseName, activeDataframeIndex, activeFrameIndex, plotAction, plotActionNonce, datasourceFilesByDataframe, availableDatasets, missing, onJump, autoRefresh, onAutoRefreshChange }: Props) {
  const { t } = useI18n()
  const attributionUnlocked = useAttributionUnlocked()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const imageBlobRef = useRef<Blob | null>(null)
  const [createdPlots, setCreatedPlots] = useState<RenderedPlotEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<PreviewStatus>('idle')
  const [error, setError] = useState<PageError | null>(null)
  const [messages, setMessages] = useState<string[]>([])
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [batchFailures, setBatchFailures] = useState<BatchFailure[]>([])
  const [renderProgress, setRenderProgress] = useState<RenderProgressState | null>(null)
  /** The preview is shown as a large overlay instead of in the side panel. */
  const [expanded, setExpanded] = useState(false)
  const [showExport, setShowExport] = useState(false)
  useEffect(() => {
    if (!expanded || showExport) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expanded, showExport])
  const panelRef = useRef<HTMLDivElement | null>(null)
  const latestPreviewRequestRef = useRef(0)
  const handledPlotActionNonceRef = useRef<number | null>(null)
  const createdPlotsRef = useRef<RenderedPlotEntry[]>([])
  const activeDataframe = plotConfig.dataframes[activeDataframeIndex]
  const activeFrame = activeDataframe?.frames[activeFrameIndex]
  const canRender = missing.length === 0

  const getDownloadName = (entry: Pick<RenderedPlotEntry, 'dataframeIndex' | 'frameIndex' | 'mediaType'>) => {
    const extension = entry.mediaType.includes('png') ? 'png' : 'svg'
    const dataframeName = plotConfig.dataframes[entry.dataframeIndex]?.name?.trim() || `DF${entry.dataframeIndex + 1}`
    const frameName = plotConfig.dataframes[entry.dataframeIndex]?.frames[entry.frameIndex]?.name?.trim() || `Frame${entry.frameIndex + 1}`
    return `${dataframeName}_${frameName}.${extension}`
  }

  const plotLabel = (dataframeIndex: number, frameIndex: number) => t('plotLabel', { df: dataframeIndex + 1, frame: frameIndex + 1 })

  // The panel follows the website theme. Only a transparent image gets a backing, matching the plot's
  // dark mode (a dataset setting), so its light or dark text stays readable; other
  // images bring their own background.
  const imageBackgroundClassName = (dataframeIndex: number) => {
    const dataframe = plotConfig.dataframes[dataframeIndex]
    if (!dataframe?.transparent) return ''
    return dataframe.darkMode ? 'bg-zinc-950' : 'bg-white'
  }

  /** Dataframe/frame pairs checked for "Generate all" and the zip download. */
  const includedPlots = () => {
    const dataframeSelection = plotConfig.createAllDataframes === true
      ? plotConfig.dataframes.map((_, index) => index)
      : plotConfig.createAllDataframes
    return dataframeSelection.flatMap((dataframeIndex) => {
      const dataframe = plotConfig.dataframes[dataframeIndex]
      if (!dataframe) return []
      const frameSelection = dataframe.createAllFrames === true ? dataframe.frames.map((_, index) => index) : dataframe.createAllFrames
      return frameSelection.filter((frameIndex) => frameIndex < dataframe.frames.length).map((frameIndex) => ({ dataframeIndex, frameIndex }))
    })
  }

  /**
   * Renders one plot and records it in the debug log. A single preview shows its error directly;
   * batch renders (includeInCreated) return the error, so the batch can list every failure.
   */
  const fetchPlot = async (dataframeIndex = activeDataframeIndex, frameIndex = activeFrameIndex, includeInCreated = false): Promise<BackendErrorDetails | null> => {
    const label = plotLabel(dataframeIndex, frameIndex)
    const startedAt = performance.now()
    const elapsed = () => Math.round(performance.now() - startedAt)
    const unreachable = t('backendUnreachable')
    const isPreview = dataframeIndex === activeDataframeIndex && frameIndex === activeFrameIndex
    const requestId = isPreview ? ++latestPreviewRequestRef.current : latestPreviewRequestRef.current
    const showMessages = (next: string[]) =>
      includeInCreated
        ? setMessages((current) => [...current, ...next.map((message) => `${plotLabel(dataframeIndex, frameIndex)}: ${message}`)])
        : setMessages(next)
    setLoading(true)
    if (!includeInCreated) {
      setError(null)
      setMessages([])
      setStatus('loading')
    }

    // Progress: the backend reports where the render is while we wait for it.
    const statusId = crypto.randomUUID()
    const lastStatus: { current: RenderStatus | null } = { current: null }
    // Counts "unknown" answers while the backend has never reported this render.
    const unknownAnswers = { count: 0 }
    const isNotReceived = () => lastStatus.current === null && unknownAnswers.count >= NOT_RECEIVED_AFTER_POLLS
    setRenderProgress({ id: statusId, label, startedAt: Date.now(), status: null, statusUnavailable: false, notReceived: false })
    const stopPolling = pollRenderStatus(statusId, (status) => {
      if (status === 'unknown') unknownAnswers.count += 1
      else if (status) lastStatus.current = status
      setRenderProgress((current) => current?.id === statusId
        ? { ...current, status: lastStatus.current, statusUnavailable: status === null, notReceived: isNotReceived() }
        : current)
    })

    try {
      const response = await fetchBackend(
        '/api/render-plot',
        await buildPlotRequest(
          {
            config: toExternalConfig(plotConfig),
            dataframe_index: dataframeIndex,
            frame_index: frameIndex,
            include_log: true,
            request_id: statusId,
          },
          plotConfig,
          datasourceFilesByDataframe,
          availableDatasets,
          [dataframeIndex],
          t,
        ),
        { unreachable, foreign: t('backendForeign'), timeoutMs: RENDER_TIMEOUT_MS, timedOut: t('renderTimedOut', { seconds: RENDER_TIMEOUT_MS / 1000 }) },
      )

      if (!response.ok) {
        throw await readBackendError(response, { fallback: t('renderFailed', { status: response.status }), unreachable })
      }

      // With include_log the backend answers with JSON; an older backend sends the image itself.
      let imageBlob: Blob
      let nextMessages: string[]
      let log: string | undefined
      if (response.headers.get('Content-Type')?.includes('application/json')) {
        const payload = await response.json() as RenderPlotResponse
        imageBlob = base64ToBlob(payload.image, payload.media_type)
        nextMessages = payload.messages ?? []
        log = payload.log
      } else {
        nextMessages = parseBackendMessages(response.headers.get('X-Ashby-Messages'))
        imageBlob = await response.blob()
      }
      if (imageBlob.size === 0) {
        throw new BackendError({ message: t('emptyImage'), messages: nextMessages, log, status: response.status })
      }
      showMessages(nextMessages)
      addLogEntry({ level: nextMessages.length > 0 ? 'warning' : 'info', source: 'render', title: label, message: t('renderSucceeded'), messages: nextMessages, log, status: response.status, durationMs: elapsed() })

      const nextUrl = URL.createObjectURL(imageBlob)
      // Ignore responses for previews that were superseded by a newer request.
      if (isPreview && requestId === latestPreviewRequestRef.current) {
        imageBlobRef.current = imageBlob
        setImageUrl(nextUrl)
        setStatus('ok')
      } else {
        URL.revokeObjectURL(nextUrl)
      }
      if (includeInCreated) {
        setCreatedPlots((current) => {
          const existing = current.find((entry) => entry.dataframeIndex === dataframeIndex && entry.frameIndex === frameIndex)
          if (existing) {
            URL.revokeObjectURL(existing.url)
          }
          const rest = current.filter((entry) => !(entry.dataframeIndex === dataframeIndex && entry.frameIndex === frameIndex))
          // Own URL per entry: the preview URL is revoked when the preview changes.
          return [...rest, { dataframeIndex, frameIndex, url: URL.createObjectURL(imageBlob), blob: imageBlob, mediaType: imageBlob.type }]
        })
      }
      return null
    } catch (renderError) {
      if (isPreview && requestId === latestPreviewRequestRef.current) {
        imageBlobRef.current = null
        setImageUrl(null)
        setStatus('error')
      }
      let details = toErrorDetails(renderError, t('renderFailedGeneric'))
      // Without an error report from the backend (e.g. a timeout), show the last state it reported.
      const known = lastStatus.current
      if (known && !details.location) {
        details = {
          ...details,
          location: known.location,
          log: [details.log, `${t('lastBackendState', { seconds: known.elapsedSeconds })}:`, known.waitingIn && `${t('backendWaitingIn')}: ${known.waitingIn}`, ...known.outputTail].filter(Boolean).join('\n'),
        }
      } else if (isNotReceived()) {
        details = { ...details, message: `${details.message} ${t('renderNotReceived')}` }
      }
      addLogEntry({ level: 'error', source: 'render', title: label, ...details, durationMs: elapsed() })
      if (!includeInCreated) setError({ title: t('renderErrorTitle', { plot: label }), details })
      return details
    } finally {
      stopPolling()
      setRenderProgress((current) => (current?.id === statusId ? null : current))
      setLoading(false)
    }
  }

  const createPlots = async () => {
    setIsBatchMode(true)
    setError(null)
    setMessages([])
    setBatchFailures([])
    setCreatedPlots((current) => {
      current.forEach((entry) => URL.revokeObjectURL(entry.url))
      return []
    })
    const plots = includedPlots()
    setBatchProgress({ current: 0, total: plots.length })
    let completed = 0
    for (const { dataframeIndex, frameIndex } of plots) {
      const failure = await fetchPlot(dataframeIndex, frameIndex, true)
      if (failure) {
        setBatchFailures((current) => [...current, { dataframeIndex, frameIndex, details: failure }])
      }
      completed += 1
      setBatchProgress({ current: completed, total: plots.length })
    }
    setBatchProgress(null)
    setIsBatchMode(false)
  }

  const downloadSinglePlot = (entry: RenderedPlotEntry) => {
    const anchor = document.createElement('a')
    anchor.href = entry.url
    anchor.download = getDownloadName(entry)
    anchor.click()
  }
  const downloadPreview = () => {
    const blob = imageBlobRef.current
    if (!blob) return
    downloadBlob(blob, getDownloadName({ dataframeIndex: activeDataframeIndex, frameIndex: activeFrameIndex, mediaType: blob.type }))
  }
  const downloadPlots = async (entries: Array<{ dataframeIndex: number; frameIndex: number }>) => {
    const plots = entries.map((entry) => ({ dataframe_index: entry.dataframeIndex, frame_index: entry.frameIndex }))
    const startedAt = performance.now()
    const unreachable = t('backendUnreachable')
    setError(null)
    try {
      const response = await fetchBackend(
        '/api/download-plots',
        await buildPlotRequest(
          {
            config: toExternalConfig(plotConfig),
            plots,
          },
          plotConfig,
          datasourceFilesByDataframe,
          availableDatasets,
          plots.map((plot) => plot.dataframe_index),
          t,
        ),
        // The zip renders every plot again, one after another.
        { unreachable, foreign: t('backendForeign'), timeoutMs: RENDER_TIMEOUT_MS * Math.max(1, plots.length), timedOut: t('requestTimedOut', { seconds: (RENDER_TIMEOUT_MS * Math.max(1, plots.length)) / 1000 }) },
      )
      if (!response.ok) {
        throw await readBackendError(response, { fallback: t('downloadAllFailed', { status: response.status }), unreachable })
      }
      const zipBaseName = configBaseName.trim() || 'ashby-plots'
      downloadBlob(await response.blob(), `${zipBaseName}.zip`)
      addLogEntry({ level: 'info', source: 'download', title: t('downloadAll'), message: t('downloadSucceeded', { count: plots.length }), status: response.status, durationMs: Math.round(performance.now() - startedAt) })
    } catch (downloadError) {
      const details = toErrorDetails(downloadError, t('downloadAllFailedGeneric'))
      addLogEntry({ level: 'error', source: 'download', title: t('downloadAll'), ...details, durationMs: Math.round(performance.now() - startedAt) })
      setError({ title: t('downloadErrorTitle'), details })
    }
  }

  // One effect for these triggers, so mounting renders once: a new plot action runs that action, a
  // selection change re-renders the preview. Plots with missing required settings are not sent.
  useEffect(() => {
    if (availableDatasets === null) return
    if (handledPlotActionNonceRef.current !== plotActionNonce) {
      handledPlotActionNonceRef.current = plotActionNonce
      if (plotAction === 'create-all') {
        void createPlots()
        return
      }
    }
    if (!canRender) return
    void fetchPlot()
    // canRender: renders as soon as the last required setting is set, e.g. when an Excel file is
    // restored from browser storage after the page loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDataframeIndex, activeFrameIndex, plotActionNonce, availableDatasets, canRender])

  // Auto-refresh: re-render after the active dataframe's config stops changing for a moment.
  // Selection changes are handled by the effect above.
  // Memoized: the dataframe object only changes when one of its settings does. Entering or dropping
  // the attribution key changes what the server draws, so it counts as a change too.
  const configKey = useMemo(() => (activeDataframe ? `${attributionUnlocked}:${JSON.stringify(activeDataframe)}` : ''), [activeDataframe, attributionUnlocked])
  const selectionKey = `${activeDataframeIndex}:${activeFrameIndex}`
  const lastConfigRef = useRef({ configKey, selectionKey })
  useEffect(() => {
    const last = lastConfigRef.current
    lastConfigRef.current = { configKey, selectionKey }
    if (last.configKey === configKey || last.selectionKey !== selectionKey) return
    if (!autoRefresh || !canRender || availableDatasets === null) {
      setStatus((current) => (current === 'idle' ? current : 'stale'))
      return
    }
    const timer = setTimeout(() => { void fetchPlot() }, AUTO_REFRESH_DELAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, selectionKey])

  // A newly selected plot is shown from the top, above the list of generated plots.
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 })
  }, [selectionKey])

  // Generated plots are labelled by position: when dataframes or frames are added, removed, moved
  // or the config is replaced, the list no longer matches and is cleared.
  const structureKey = plotConfig.dataframes.map((dataframe) => [dataframe._extensions.uiKey, ...dataframe.frames.map((frame) => frame._extensions.uiKey)].join(',')).join('|')
  const lastStructureKeyRef = useRef(structureKey)
  useEffect(() => {
    if (lastStructureKeyRef.current === structureKey) return
    lastStructureKeyRef.current = structureKey
    setBatchFailures([])
    setCreatedPlots((current) => {
      current.forEach((entry) => URL.revokeObjectURL(entry.url))
      return []
    })
  }, [structureKey])

  useEffect(() => () => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  useEffect(() => {
    createdPlotsRef.current = createdPlots
  }, [createdPlots])

  useEffect(() => () => {
    createdPlotsRef.current.forEach((entry) => URL.revokeObjectURL(entry.url))
  }, [])

  const createdPlotsSorted = [...createdPlots].sort((a, b) =>
    a.dataframeIndex === b.dataframeIndex ? a.frameIndex - b.frameIndex : a.dataframeIndex - b.dataframeIndex,
  )
  const pill = !canRender
    ? { text: t('cannotRender'), className: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' }
    : loading || status === 'loading'
      ? { text: t('renderingShort'), className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' }
      : status === 'stale'
        ? { text: t('changesNotRendered'), className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' }
        : status === 'error'
          ? { text: t('renderError'), className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' }
          : status === 'ok'
            ? { text: t('upToDate'), className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' }
            : null
  const includedCount = includedPlots().length

  return (
    <>
    {expanded ? <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/40" onClick={() => setExpanded(false)} /> : null}
    <div
      ref={panelRef}
      className={`flex min-h-0 min-w-0 flex-col gap-3 overflow-auto bg-zinc-50 px-4 pb-4 text-left dark:bg-zinc-950 [&>*]:shrink-0 ${expanded ? 'fixed inset-3 z-40 rounded-xl border border-zinc-300 shadow-2xl sm:inset-6 dark:border-zinc-700' : ''}`}
    >
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mr-auto grid min-w-0">
          <span className="text-[11px] text-zinc-500">{t('preview')} · <span className="font-mono uppercase">{activeDataframe?.language}</span></span>
          <strong className="truncate text-sm">{activeFrame?.name || `Frame ${activeFrameIndex + 1}`}</strong>
        </div>
        {pill ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.className}`}>{pill.text}</span> : null}
        <Button type="button" variant="outline" size="sm" onClick={() => void fetchPlot()} disabled={loading || !canRender} title={t('refreshPreview')} aria-label={t('refreshPreview')}>
          ↻
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((current) => !current)} aria-pressed={expanded} title={expanded ? t('shrinkPreview') : t('expandPreview')} aria-label={expanded ? t('shrinkPreview') : t('expandPreview')}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
            {expanded
              ? <path d="M6.5 2.5v4h-4M9.5 13.5v-4h4M6.5 6.5 2 2M9.5 9.5 14 14" />
              : <path d="M10 2.5h3.5V6M6 13.5H2.5V10M13.5 2.5 9 7M2.5 13.5 7 9" />}
          </svg>
        </Button>
        <Button type="button" size="sm" onClick={() => setShowExport(true)}>{t('exportButton')}</Button>
      </div>

      {!canRender ? (
        <div className="grid gap-1 rounded-lg border border-orange-400 bg-orange-50 px-3 py-2 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
          <strong>{t('missingCount', { count: missing.length })}</strong>
          {missing.map((entry) => (
            <button key={`${entry.section}-${entry.setting}`} type="button" className="w-fit text-left underline underline-offset-2" onClick={() => { setExpanded(false); onJump(entry.section, entry.setting) }}>
              {t(entry.setting)} →
            </button>
          ))}
        </div>
      ) : null}

      {renderProgress ? <RenderProgressBox progress={renderProgress} /> : null}
      {error && canRender ? <ErrorDetails title={error.title} details={error.details} /> : null}
      {messages.length > 0 ? (
        <Alert>
          <div className="grid gap-1">
            <strong>{t('plotMessages')}</strong>
            {messages.map((message, index) => (
              <p key={index} className="m-0">
                {message}
              </p>
            ))}
          </div>
        </Alert>
      ) : null}

      <section className="grid min-h-48 place-items-center overflow-hidden rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
        {imageUrl && !isBatchMode && canRender ? <img src={imageUrl} alt={t('renderedPlotAlt')} className={`block max-w-full rounded ${imageBackgroundClassName(activeDataframeIndex)} ${expanded ? 'max-h-[calc(100svh-11rem)] w-auto' : 'h-auto'}`} /> : (
          <span className="p-6 text-center text-sm text-zinc-500">{canRender ? (loading ? t('renderingShort') : t('nothingRendered')) : t('cannotRender')}</span>
        )}
      </section>

      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <input type="checkbox" className="accent-brand-600" checked={autoRefresh} onChange={(event) => onAutoRefreshChange(event.target.checked)} />
        {t('autoRefresh')}
      </label>

      {batchProgress ? <p className="m-0 text-xs text-zinc-500">{t('batchProgress', { current: batchProgress.current, total: batchProgress.total })}</p> : null}
      {batchFailures.length > 0 ? (
        <div className="grid gap-2">
          <strong className="text-sm text-red-700 dark:text-red-300">{t('batchFailures', { count: batchFailures.length })}</strong>
          {batchFailures.map((failure) => (
            <ErrorDetails key={`${failure.dataframeIndex}-${failure.frameIndex}`} title={plotLabel(failure.dataframeIndex, failure.frameIndex)} details={failure.details} />
          ))}
        </div>
      ) : null}
      {createdPlotsSorted.length > 0 ? (
        <div className="grid gap-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm">{t('createdPlots')}</strong>
            <Button type="button" variant="outline" size="sm" onClick={() => void downloadPlots(createdPlotsSorted)}>{t('downloadAll')}</Button>
          </div>
          {createdPlotsSorted.map((entry) => (
            <article key={`${entry.dataframeIndex}-${entry.frameIndex}`} className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="m-0 text-xs font-semibold text-zinc-500">{plotLabel(entry.dataframeIndex, entry.frameIndex)}</h4>
                <button
                  type="button"
                  className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  onClick={() => downloadSinglePlot(entry)}
                  title={t('downloadThisPlot')}
                >
                  ⬇️ {t('downloadThis')}
                </button>
              </div>
              <img src={entry.url} alt={`${t('renderedPlotAlt')} (${plotLabel(entry.dataframeIndex, entry.frameIndex)})`} className={`block h-auto max-w-full rounded-md ${imageBackgroundClassName(entry.dataframeIndex)}`} />
            </article>
          ))}
        </div>
      ) : null}

      {showExport && activeDataframe ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={(event) => { if (event.target === event.currentTarget) setShowExport(false) }}>
          <div role="dialog" aria-modal="true" aria-labelledby="export-title" className="grid w-full max-w-md gap-4 rounded-xl border border-zinc-300 bg-white p-5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <h3 id="export-title" className="m-0 text-base font-semibold">{t('exportTitle')}</h3>
            <p className="m-0 text-xs text-zinc-500">{t('exportSettingsOf', { name: dataframeLabel(activeDataframe, activeDataframeIndex) })}</p>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-violet-50 px-3 py-2.5 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200">
              <dt className="font-semibold">{t('fileFormat')}</dt>
              <dd className="m-0">{activeDataframe.fileformat.toUpperCase()}{activeDataframe.fileformat === 'png' ? ` · ${activeDataframe.resolution} dpi` : ''}</dd>
              <dt className="font-semibold">{t('plotLanguage')}</dt>
              <dd className="m-0 font-mono uppercase">{activeDataframe.language}</dd>
              <dt className="font-semibold">{t('background')}</dt>
              <dd className="m-0">{activeDataframe.transparent ? t('bgTransparent') : activeDataframe.darkMode ? t('bgDark') : t('bgWhite')}</dd>
              {attributionUnlocked && (
                <>
                  <dt className="font-semibold">{t('watermark')}</dt>
                  <dd className="m-0">{activeDataframe.watermark ? t('on') : t('off')}</dd>
                  <dt className="font-semibold">{t('copyright')}</dt>
                  <dd className="m-0">{activeDataframe.copyright ? t('on') : t('off')}</dd>
                </>
              )}
            </dl>
            <button type="button" className="w-fit text-xs font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300" onClick={() => { setShowExport(false); setExpanded(false); onJump('textLook', 'output') }}>
              {t('changeInOutput')} →
            </button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowExport(false)}>{t('cancel')}</Button>
              <Button type="button" variant="outline" disabled={includedCount === 0} onClick={() => { setShowExport(false); void downloadPlots(includedPlots()) }}>
                {t('downloadIncluded', { count: includedCount })}
              </Button>
              <Button type="button" disabled={!imageUrl || !canRender} onClick={() => { setShowExport(false); downloadPreview() }}>{t('downloadThisPlot')}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </>
  )
}
