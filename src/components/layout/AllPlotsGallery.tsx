import { useEffect, useMemo, useRef, useState } from 'react'
import type { DataframeConfig, FrameConfig, PlotConfig } from '../../config/defaultPlotConfig'
import { useI18n } from '../../uiTranslations'
import { dataframeLabel, frameLabel } from '../../utils/appState'
import { useAttributionUnlocked } from '../../utils/attributionKey'
import { toErrorDetails } from '../../utils/backendErrors'
import { getDataframeMissing, getFrameMissing } from '../../utils/settingsStatus'

/** Pause after a change (and between two plots) before the next plot is rendered. */
const RENDER_DELAY_MS = 1200

type Props = {
  plotConfig: PlotConfig
  activeDataframeIndex: number
  activeFrameIndex: number
  datasourceFilesByDataframe: Record<number, File>
  availableDatasets: string[] | null
  autoRefresh: boolean
  /** Renders one plot; resolves with the image. */
  renderPlot: (dataframeIndex: number, frameIndex: number) => Promise<Blob>
  onSelectPlot: (dataframeIndex: number, frameIndex: number) => void
}

/** The last image of a plot and the settings it was rendered with (`key`). */
type Thumbnail = { key: string; url?: string; error?: string }

type GalleryPlot = { id: string; key: string; dataframeIndex: number; frameIndex: number; label: string; canRender: boolean }

/**
 * Everything a plot's image depends on: its dataframe's settings except the other plots, its own
 * settings, the data file and whether the attribution key is entered (see apply_attribution).
 */
const renderKey = (dataframe: DataframeConfig, frame: FrameConfig, file: File | undefined, unlocked: boolean) =>
  // JSON leaves out the undefined entries: the other plots and which plots "Generate all" includes
  JSON.stringify([unlocked, file ? [file.name, file.size, file.lastModified] : null, { ...dataframe, frames: undefined, createAllFrames: undefined }, frame])

/**
 * The other plots of the config below the preview. Nothing is rendered on load, so opening a
 * config does not send every plot to the server; from the first edit on, the plots whose settings
 * changed since their last image (or that have none) are rendered, one at a time.
 */
export function AllPlotsGallery({ plotConfig, activeDataframeIndex, activeFrameIndex, datasourceFilesByDataframe, availableDatasets, autoRefresh, renderPlot, onSelectPlot }: Props) {
  const { t } = useI18n()
  const unlocked = useAttributionUnlocked()
  const [thumbnails, setThumbnails] = useState<Record<string, Thumbnail>>({})
  const [rendering, setRendering] = useState<string | null>(null)
  const [edited, setEdited] = useState(false)

  const plots = useMemo<GalleryPlot[]>(() => plotConfig.dataframes.flatMap((dataframe, dataframeIndex) => {
    const file = datasourceFilesByDataframe[dataframeIndex]
    const dataframeMissing = getDataframeMissing(dataframe, availableDatasets ?? [], Boolean(dataframe.importFileName) && file?.name === dataframe.importFileName)
    return dataframe.frames.map((frame, frameIndex) => ({
      id: `${String(dataframe._extensions.uiKey)}/${String(frame._extensions.uiKey)}`,
      key: renderKey(dataframe, frame, file, unlocked),
      dataframeIndex,
      frameIndex,
      label: `${dataframeLabel(dataframe, dataframeIndex)} · ${frameLabel(frame, frameIndex)}`,
      canRender: dataframeMissing.length === 0 && getFrameMissing(frame).length === 0,
    }))
  }), [plotConfig, datasourceFilesByDataframe, availableDatasets, unlocked])
  const others = plots.filter((plot) => plot.dataframeIndex !== activeDataframeIndex || plot.frameIndex !== activeFrameIndex)

  // An edit is a config change after the page was used (clicked or typed in): restoring the
  // config or data files on load does not count.
  const firstConfigRef = useRef(plotConfig)
  useEffect(() => {
    if (edited || plotConfig === firstConfigRef.current) return
    if (navigator.userActivation?.hasBeenActive ?? true) setEdited(true)
  }, [plotConfig, edited])

  // One plot at a time, after a pause; the next one once it is done.
  const next = edited && autoRefresh && availableDatasets !== null && rendering === null
    ? others.find((plot) => plot.canRender && thumbnails[plot.id]?.key !== plot.key)
    : undefined
  useEffect(() => {
    if (!next) return
    const { id, key, dataframeIndex, frameIndex } = next
    const timer = setTimeout(() => {
      setRendering(id)
      renderPlot(dataframeIndex, frameIndex)
        .then((blob) => setThumbnails((current) => {
          if (current[id]?.url) URL.revokeObjectURL(current[id].url)
          return { ...current, [id]: { key, url: URL.createObjectURL(blob) } }
        }))
        // the last image stays, with the error below it, until the settings change again
        .catch((error: unknown) => setThumbnails((current) => ({ ...current, [id]: { ...current[id], key, error: toErrorDetails(error, t('renderFailedGeneric')).message } })))
        .finally(() => setRendering(null))
    }, RENDER_DELAY_MS)
    return () => clearTimeout(timer)
    // the plot to render and its settings; renderPlot changes with every render of the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.id, next?.key])

  // Images of removed plots are dropped; all are released when the page goes.
  const plotIds = plots.map((plot) => plot.id).join('|')
  useEffect(() => {
    const ids = new Set(plotIds.split('|'))
    setThumbnails((current) => {
      const removed = Object.keys(current).filter((id) => !ids.has(id))
      if (removed.length === 0) return current
      removed.forEach((id) => { if (current[id].url) URL.revokeObjectURL(current[id].url) })
      return Object.fromEntries(Object.entries(current).filter(([id]) => ids.has(id)))
    })
  }, [plotIds])
  const thumbnailsRef = useRef(thumbnails)
  useEffect(() => { thumbnailsRef.current = thumbnails }, [thumbnails])
  useEffect(() => () => { Object.values(thumbnailsRef.current).forEach((thumbnail) => { if (thumbnail.url) URL.revokeObjectURL(thumbnail.url) }) }, [])

  if (others.length === 0) return null

  const background = (dataframeIndex: number) => {
    const dataframe = plotConfig.dataframes[dataframeIndex]
    return dataframe?.transparent ? (dataframe.darkMode ? 'bg-zinc-950' : 'bg-white') : ''
  }
  const statusText = (plot: GalleryPlot, thumbnail: Thumbnail | undefined) => {
    if (rendering === plot.id) return t('renderingShort')
    if (!plot.canRender) return t('cannotRender')
    if (!thumbnail) return edited ? (autoRefresh ? t('allPlotsQueued') : t('changesNotRendered')) : t('allPlotsAfterEdit')
    if (thumbnail.key !== plot.key) return autoRefresh ? t('allPlotsQueued') : t('changesNotRendered')
    return null
  }

  return (
    <section className="grid gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800" aria-label={t('allPlots')}>
      <div className="grid gap-0.5">
        <strong className="text-sm">{t('allPlots')}</strong>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{edited ? t('allPlotsHint') : t('allPlotsHintBeforeEdit')}</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
        {others.map((plot) => {
          const thumbnail = thumbnails[plot.id]
          const status = statusText(plot, thumbnail)
          return (
            <button
              key={plot.id}
              type="button"
              onClick={() => onSelectPlot(plot.dataframeIndex, plot.frameIndex)}
              title={t('allPlotsSelect', { plot: plot.label })}
              className="grid content-start gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 text-left hover:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-500"
            >
              <span className="truncate px-0.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">{plot.label}</span>
              {thumbnail?.url ? (
                <img src={thumbnail.url} alt={`${t('renderedPlotAlt')} (${plot.label})`} className={`block h-auto w-full rounded ${background(plot.dataframeIndex)} ${status ? 'opacity-60' : ''}`} />
              ) : (
                <span className="grid aspect-3/2 place-items-center rounded bg-zinc-50 px-2 text-center text-[11px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">{status}</span>
              )}
              {thumbnail?.url && status ? <span className="px-0.5 text-[10px] text-zinc-500">{status}</span> : null}
              {thumbnail?.error && thumbnail.key === plot.key ? <span className="line-clamp-2 px-0.5 text-[10px] text-red-600 dark:text-red-400" title={thumbnail.error}>{thumbnail.error}</span> : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}
