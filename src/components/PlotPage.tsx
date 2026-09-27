import { useEffect, useRef, useState } from 'react'
import { downloadBlob, toExternalConfig } from '../utils/configIo'
import type { PlotConfig } from '../config/defaultPlotConfig'
import { Alert } from './ui/alert'
import { getSourceMode } from '../utils/appState'
import { Button } from './ui/button'
import { useI18n, type Translate } from '../uiTranslations'
import { BackendError, fetchBackend, readBackendError, toErrorDetails, type BackendErrorDetails } from '../utils/backendErrors'
import { addLogEntry } from '../utils/debugLog'
import { ErrorDetails } from './DebugLog'

interface Props {
  plotConfig: PlotConfig
  configBaseName: string
  activeDataframeIndex: number
  activeFrameIndex: number
  plotAction: 'preview-current' | 'create-all'
  plotActionNonce: number
  datasourceFilesByDataframe: Record<number, File>
  availableDatasets: string[] | null
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

function buildPlotRequest(
  payload: PlotRequestPayload,
  plotConfig: PlotConfig,
  datasourceFilesByDataframe: Record<number, File>,
  availableDatasets: string[] | null,
  dataframeIndices: number[],
  t: Translate,
): RequestInit {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  }

  const form = new FormData()
  const descriptors = datasourceIndices.map((dataframeIndex) => {
    const fileField = `datasource_${dataframeIndex}`
    const file = datasourceFilesByDataframe[dataframeIndex]
    form.append(fileField, file)
    return {
      dataframe_index: dataframeIndex,
      kind: 'xlsx',
      file_field: fileField,
      filename: file.name,
    }
  })
  form.append('payload', JSON.stringify(payload))
  form.append('data_sources', JSON.stringify(descriptors))

  return {
    method: 'POST',
    body: form,
  }
}

type BatchFailure = { dataframeIndex: number; frameIndex: number; details: BackendErrorDetails }
type PageError = { title: string; details: BackendErrorDetails }

export function PlotPage({ plotConfig, configBaseName, activeDataframeIndex, activeFrameIndex, plotAction, plotActionNonce, datasourceFilesByDataframe, availableDatasets }: Props) {
  const { t } = useI18n()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [createdPlots, setCreatedPlots] = useState<RenderedPlotEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<PageError | null>(null)
  const [messages, setMessages] = useState<string[]>([])
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [batchFailures, setBatchFailures] = useState<BatchFailure[]>([])
  const latestPreviewRequestRef = useRef(0)
  const handledPlotActionNonceRef = useRef<number | null>(null)
  const createdPlotsRef = useRef<RenderedPlotEntry[]>([])

  const getDownloadName = (entry: RenderedPlotEntry) => {
    const extension = entry.mediaType.includes('png') ? 'png' : 'svg'
    const dataframeName = plotConfig.dataframes[entry.dataframeIndex]?.name?.trim() || `Dataframe${entry.dataframeIndex + 1}`
    const frameName = plotConfig.dataframes[entry.dataframeIndex]?.frames[entry.frameIndex]?.name?.trim() || `Frame${entry.frameIndex + 1}`
    return `${dataframeName}_${frameName}.${extension}`
  }

  const plotLabel = (dataframeIndex: number, frameIndex: number) => t('plotLabel', { df: dataframeIndex + 1, frame: frameIndex + 1 })

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
    }

    try {
      const response = await fetchBackend(
        '/api/render-plot',
        buildPlotRequest(
          {
            config: toExternalConfig(plotConfig),
            dataframe_index: dataframeIndex,
            frame_index: frameIndex,
            include_log: true,
          },
          plotConfig,
          datasourceFilesByDataframe,
          availableDatasets,
          [dataframeIndex],
          t,
        ),
        unreachable,
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
        setImageUrl(nextUrl)
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
        setImageUrl(null)
      }
      const details = toErrorDetails(renderError, t('renderFailedGeneric'))
      addLogEntry({ level: 'error', source: 'render', title: label, ...details, durationMs: elapsed() })
      if (!includeInCreated) setError({ title: t('renderErrorTitle', { plot: label }), details })
      return details
    } finally {
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
    const dataframeSelection =
      plotConfig.createAllDataframes === true
        ? plotConfig.dataframes.map((_, index) => index)
        : plotConfig.createAllDataframes

    const total = dataframeSelection.reduce((count, dataframeIndex) => {
      const dataframe = plotConfig.dataframes[dataframeIndex]
      if (!dataframe) return count
      const frameSelection = dataframe.createAllFrames === true ? dataframe.frames.map((_, index) => index) : dataframe.createAllFrames
      return count + frameSelection.length
    }, 0)
    setBatchProgress({ current: 0, total })
    let completed = 0
    for (const dataframeIndex of dataframeSelection) {
      const dataframe = plotConfig.dataframes[dataframeIndex]
      if (!dataframe) continue
      const frameSelection = dataframe.createAllFrames === true ? dataframe.frames.map((_, index) => index) : dataframe.createAllFrames
      for (const frameIndex of frameSelection) {
        const failure = await fetchPlot(dataframeIndex, frameIndex, true)
        if (failure) {
          setBatchFailures((current) => [...current, { dataframeIndex, frameIndex, details: failure }])
        }
        completed += 1
        setBatchProgress({ current: completed, total })
      }
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
  const downloadAllCreatedPlots = async () => {
    const plots = createdPlots.map((entry) => ({ dataframe_index: entry.dataframeIndex, frame_index: entry.frameIndex }))
    const startedAt = performance.now()
    const unreachable = t('backendUnreachable')
    setError(null)
    try {
      const response = await fetchBackend(
        '/api/download-plots',
        buildPlotRequest(
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
        unreachable,
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

  // One effect for both triggers, so mounting the page renders once: a new plot action runs that
  // action, a selection change re-renders the preview.
  useEffect(() => {
    if (availableDatasets === null) return
    if (handledPlotActionNonceRef.current !== plotActionNonce) {
      handledPlotActionNonceRef.current = plotActionNonce
      if (plotAction === 'create-all') {
        void createPlots()
        return
      }
    }
    void fetchPlot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDataframeIndex, activeFrameIndex, plotActionNonce, availableDatasets])

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

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-5 text-left">
      <section className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-transparent">
        <div>
          <h3 className="m-0 text-sm font-semibold">{t('plotPreviewTitle')}</h3>
          <p className="m-0 mt-1 text-xs text-zinc-500">
            {t('plotPreviewText', { df: activeDataframeIndex + 1, frame: activeFrameIndex + 1 })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void fetchPlot()} disabled={loading} title={t('refreshPreview')} aria-label={t('refreshPreview')}>
            ↻
          </Button>
          <Button type="button" variant="outline" onClick={() => void downloadAllCreatedPlots()} disabled={createdPlots.length === 0}>
            {t('downloadAll')}
          </Button>
        </div>
      </section>
      {batchProgress ? <p className="m-0 text-xs text-zinc-500">{t('batchProgress', { current: batchProgress.current, total: batchProgress.total })}</p> : null}

      {error ? <ErrorDetails title={error.title} details={error.details} /> : null}
      {batchFailures.length > 0 ? (
        <div className="grid gap-2">
          <strong className="text-sm text-red-700 dark:text-red-300">{t('batchFailures', { count: batchFailures.length })}</strong>
          {batchFailures.map((failure) => (
            <ErrorDetails key={`${failure.dataframeIndex}-${failure.frameIndex}`} title={plotLabel(failure.dataframeIndex, failure.frameIndex)} details={failure.details} />
          ))}
        </div>
      ) : null}
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

      <section className="min-h-[55vh] overflow-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {loading && !imageUrl ? <p className="text-sm text-zinc-500">{t('renderingPlot')}</p> : null}
        {imageUrl && !isBatchMode ? <img src={imageUrl} alt={t('renderedPlotAlt')} className="block h-auto max-w-full" /> : null}
        {createdPlotsSorted.length > 0 ? (
          <div className="mt-6 grid gap-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
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
                <img src={entry.url} alt={`${t('renderedPlotAlt')} (${plotLabel(entry.dataframeIndex, entry.frameIndex)})`} className="block h-auto max-w-full" />
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}
