import { useState, type Dispatch, type DragEvent, type MouseEvent, type SetStateAction } from 'react'
import type { PlotConfig } from '../config/defaultPlotConfig'
import { useI18n } from '../uiTranslations'
import { dataframeLabel, getSelectedIndices, getUiKey } from '../utils/appState'
import { Button } from './ui/button'

type TabRename = { type: 'dataframe' | 'frame'; index: number; value: string }

type Props = {
  plotConfig: PlotConfig
  activeDataframeIndex: number
  activeFrameIndex: number
  /** The active settings section is shared by the dataframe: its frames are highlighted. */
  highlightShared: boolean
  selectPlot: (dataframeIndex: number, frameIndex: number) => void
  addDataframe: () => void
  addFrame: (dataframeIndex: number) => void
  applyTabRename: () => void
  duplicateDataframe: (index: number) => void
  duplicateFrame: (dataframeIndex: number, index: number) => void
  /** Moves a plot before position `targetIndex` of a dataset (the same or another one). */
  moveFrame: (sourceDataframeIndex: number, sourceFrameIndex: number, targetDataframeIndex: number, targetIndex: number) => void
  openTabWithSelection: (dataframeIndex: number, frameIndex: number) => void
  removeDataframe: (index: number) => void
  removeFrame: (dataframeIndex: number, index: number) => void
  reorderDataframes: (from: number, to: number) => void
  setTabRename: Dispatch<SetStateAction<TabRename | null>>
  tabRename: TabRename | null
  toggleDataframeGeneration: (index: number, enabled: boolean) => void
  toggleFrameGeneration: (dataframeIndex: number, index: number, enabled: boolean) => void
  /** Number of required settings a frame is missing. */
  frameMissingCount: (dataframeIndex: number, frameIndex: number) => number
  /** Number of required dataset settings a dataframe is missing. */
  dataframeMissingCount: (dataframeIndex: number) => number
  onGenerateAll: () => void
}

/** What is being dragged: a whole dataset (by its bar) or one plot tab. */
type Drag = { kind: 'dataframe'; dataframe: number } | { kind: 'frame'; dataframe: number; frame: number }

const iconButtonClassName = 'grid h-6 w-6 place-items-center rounded text-xs text-current opacity-70 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30'

/**
 * Middle click opens the plot in a new browser tab that stays in sync with this one. The tab is
 * opened on `auxclick`: Firefox-based browsers block `window.open` from `mousedown`. Mouse down
 * is only prevented, so the browser does not start autoscrolling.
 */
const middleClickOpens = (open: () => void) => ({
  onMouseDown: (event: MouseEvent<HTMLElement>) => {
    if (event.button === 1) event.preventDefault()
  },
  onAuxClick: (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 1) return
    event.preventDefault()
    open()
  },
})

/** Number of missing required settings, as a small badge at the top right of a name. */
const MissingBadge = ({ count, title, ringClassName }: { count: number; title: string; ringClassName: string }) => (
  <span
    title={title}
    aria-label={title}
    className={`pointer-events-none absolute -right-3 -top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-orange-600 px-[3px] text-[9px] font-bold leading-none text-white ring-2 ${ringClassName}`}
  >
    {count}
  </span>
)

/** Starts a drag; Firefox only drags when some data is set. */
const startDrag = (event: DragEvent<HTMLElement>) => {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', '')
}

/** One row of plot tabs grouped by dataset; replaces the former dataframe and frame tab rows. */
export function ConfigTabs(props: Props) {
  const {
    plotConfig,
    activeDataframeIndex,
    activeFrameIndex,
    highlightShared,
    selectPlot,
    addDataframe,
    addFrame,
    applyTabRename,
    duplicateDataframe,
    duplicateFrame,
    moveFrame,
    openTabWithSelection,
    removeDataframe,
    removeFrame,
    reorderDataframes,
    setTabRename,
    tabRename,
    toggleDataframeGeneration,
    toggleFrameGeneration,
    frameMissingCount,
    dataframeMissingCount,
    onGenerateAll,
  } = props
  const { t } = useI18n()
  const [drag, setDrag] = useState<Drag | null>(null)
  // Drop target: a dataset, and for plots the position they would be inserted at.
  const [drop, setDrop] = useState<{ dataframe: number; index: number } | null>(null)
  const selectedDataframes = getSelectedIndices(plotConfig.dataframes.length, plotConfig.createAllDataframes)
  const includedCount = selectedDataframes.reduce((count, index) => {
    const df = plotConfig.dataframes[index]
    return df ? count + getSelectedIndices(df.frames.length, df.createAllFrames).length : count
  }, 0)

  const endDrag = () => {
    setDrag(null)
    setDrop(null)
  }

  /** Whether the dragged plot can go to `index` of `dataframe`, and would actually move there. */
  const canDropFrame = (dataframe: number, index: number) => {
    if (drag?.kind !== 'frame') return false
    if (drag.dataframe === dataframe) return index !== drag.frame && index !== drag.frame + 1
    // A dataset keeps at least one plot.
    return (plotConfig.dataframes[drag.dataframe]?.frames.length ?? 0) > 1
  }

  const dragOverFrames = (event: DragEvent<HTMLElement>, dataframe: number, index: number) => {
    if (drag?.kind !== 'frame') return
    event.stopPropagation()
    if (!canDropFrame(dataframe, index)) {
      setDrop(null)
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (drop?.dataframe !== dataframe || drop.index !== index) setDrop({ dataframe, index })
  }

  const renameInput = (widthClassName: string) => (
    <input
      autoFocus
      value={tabRename?.value ?? ''}
      onChange={(event) => setTabRename((current) => (current ? { ...current, value: event.target.value } : current))}
      onBlur={applyTabRename}
      onKeyDown={(event) => {
        if (event.key === 'Enter') applyTabRename()
        if (event.key === 'Escape') setTabRename(null)
      }}
      className={`h-7 rounded border border-violet-500 bg-white px-2 text-xs text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 ${widthClassName}`}
    />
  )

  const dropLine = <span aria-hidden="true" className="pointer-events-none absolute -left-[3px] top-1 h-6 w-0.5 rounded bg-violet-500" />

  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-zinc-300 bg-zinc-100/80 px-4 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/70">
      <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-zinc-500">{t('plotsBar')}</span>
      {/* Only the tabs scroll; "Generate all" stays visible at the right. */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-x-auto py-1 [scrollbar-width:thin]">
      {plotConfig.dataframes.map((df, dataframeIndex) => {
        const isActiveDataframe = dataframeIndex === activeDataframeIndex
        const shared = highlightShared && isActiveDataframe
        const dataframeName = dataframeLabel(df, dataframeIndex)
        const dataframeMissing = dataframeMissingCount(dataframeIndex)
        const selectedFrames = getSelectedIndices(df.frames.length, df.createAllFrames)
        const renamingDataframe = tabRename?.type === 'dataframe' && tabRename.index === dataframeIndex
        const dataframeDropTarget = drag?.kind === 'dataframe' && drag.dataframe !== dataframeIndex && drop?.dataframe === dataframeIndex
        return (
          <div
            key={getUiKey(df, 'dataframe')}
            className={`flex shrink-0 items-stretch rounded-lg p-px transition-shadow ${dataframeDropTarget ? 'bg-violet-500 text-white shadow-[0_0_0_3px_rgb(139_92_246/0.25)]' : isActiveDataframe ? `bg-sky-600 text-white dark:bg-sky-700 ${shared ? 'shadow-[0_0_0_3px_rgb(14_165_233/0.25)]' : ''}` : 'bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200'} ${drag?.kind === 'dataframe' && drag.dataframe === dataframeIndex ? 'opacity-50' : ''}`}
            onDragOver={(event: DragEvent<HTMLDivElement>) => {
              if (drag?.kind === 'frame') {
                // Anywhere else on the group (name, gaps, "+"): behind the last plot.
                dragOverFrames(event, dataframeIndex, df.frames.length)
                return
              }
              if (drag?.kind !== 'dataframe' || drag.dataframe === dataframeIndex) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              if (drop?.dataframe !== dataframeIndex) setDrop({ dataframe: dataframeIndex, index: 0 })
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (drag?.kind === 'dataframe' && drag.dataframe !== dataframeIndex) reorderDataframes(drag.dataframe, dataframeIndex)
              if (drag?.kind === 'frame' && drop?.dataframe === dataframeIndex) moveFrame(drag.dataframe, drag.frame, dataframeIndex, drop.index)
              endDrag()
            }}
          >
            {/* Thick left edge of the group's frame: include checkbox and dataset name; also the drag handle. */}
            <div
              draggable={!renamingDataframe}
              onDragStart={(event) => {
                startDrag(event)
                setDrag({ kind: 'dataframe', dataframe: dataframeIndex })
              }}
              onDragEnd={endDrag}
              className="group flex shrink-0 cursor-grab items-center gap-1.5 pl-2 pr-2 active:cursor-grabbing"
            >
              <input
                type="checkbox"
                className={`h-3.5 w-3.5 cursor-pointer ${isActiveDataframe ? 'accent-white' : 'accent-sky-600'}`}
                checked={selectedDataframes.includes(dataframeIndex)}
                onChange={(event) => toggleDataframeGeneration(dataframeIndex, event.target.checked)}
                title={t('includeDataset')}
                aria-label={`${t('includeDataset')}: ${dataframeName}`}
              />
              {renamingDataframe ? renameInput('w-32') : (
                <span className={`relative ${dataframeMissing > 0 ? 'mr-2.5' : 'mr-1'}`}>
                  <button
                    type="button"
                    className="block max-w-44 truncate py-1 text-left text-xs font-semibold"
                    title={`${t('datasetLabel')}: ${dataframeName} · ${t('renameHint')}`}
                    onClick={() => selectPlot(dataframeIndex, isActiveDataframe ? activeFrameIndex : 0)}
                    onDoubleClick={() => setTabRename({ type: 'dataframe', index: dataframeIndex, value: dataframeName })}
                    {...middleClickOpens(() => openTabWithSelection(dataframeIndex, 0))}
                  >
                    {dataframeName}
                  </button>
                  {dataframeMissing > 0 ? (
                    <MissingBadge count={dataframeMissing} title={t('missingCount', { count: dataframeMissing })} ringClassName={isActiveDataframe ? 'ring-sky-600 dark:ring-sky-700' : 'ring-zinc-300 dark:ring-zinc-700'} />
                  ) : null}
                </span>
              )}
              <span className="hidden items-center group-focus-within:flex group-hover:flex">
                <button type="button" className={iconButtonClassName} onClick={() => duplicateDataframe(dataframeIndex)} title={t('duplicateDataset')} aria-label={t('duplicateDataset')}>⧉</button>
                <button type="button" className={iconButtonClassName} onClick={() => removeDataframe(dataframeIndex)} disabled={plotConfig.dataframes.length <= 1} title={t('removeDataset')} aria-label={t('removeDataset')}>✕</button>
              </span>
            </div>

            <div className="flex items-center gap-0.5 rounded-[7px] bg-white py-0.5 pl-1 pr-1 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
              {df.frames.map((frame, frameIndex) => {
                const active = isActiveDataframe && frameIndex === activeFrameIndex
                const frameName = frame.name || `Frame ${frameIndex + 1}`
                const missing = frameMissingCount(dataframeIndex, frameIndex)
                const renaming = tabRename?.type === 'frame' && isActiveDataframe && tabRename.index === frameIndex
                return (
                  <div
                    key={getUiKey(frame, 'frame')}
                    draggable={!renaming}
                    onDragStart={(event) => {
                      startDrag(event)
                      setDrag({ kind: 'frame', dataframe: dataframeIndex, frame: frameIndex })
                    }}
                    onDragOver={(event: DragEvent<HTMLDivElement>) => {
                      // Before or after this plot, depending on which half the pointer is over.
                      const rect = event.currentTarget.getBoundingClientRect()
                      dragOverFrames(event, dataframeIndex, frameIndex + (event.clientX > rect.left + rect.width / 2 ? 1 : 0))
                    }}
                    onDragEnd={endDrag}
                    className={`group relative flex h-8 cursor-grab items-center gap-1 rounded-md pl-2 pr-0.5 text-xs active:cursor-grabbing ${drag?.kind === 'frame' && drag.dataframe === dataframeIndex && drag.frame === frameIndex ? 'opacity-50' : ''} ${active ? (shared ? 'bg-sky-200 text-sky-950 dark:bg-sky-800/70 dark:text-sky-50' : 'bg-violet-200 text-violet-950 dark:bg-violet-800/60 dark:text-violet-50') : shared ? 'bg-sky-50 dark:bg-sky-950/40' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                  >
                    {drop?.dataframe === dataframeIndex && drop.index === frameIndex ? dropLine : null}
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-violet-600"
                      checked={selectedFrames.includes(frameIndex)}
                      onChange={(event) => toggleFrameGeneration(dataframeIndex, frameIndex, event.target.checked)}
                      title={t('includePlot')}
                      aria-label={`${t('includePlot')}: ${frameName}`}
                    />
                    {renaming ? renameInput('w-40') : (
                      <span className={`relative ${missing > 0 ? 'mr-2.5' : ''}`}>
                        <button
                          type="button"
                          aria-current={active ? 'page' : undefined}
                          className={`block max-w-60 truncate rounded px-1 py-1 ${active ? 'font-semibold' : ''}`}
                          title={`${frameName} · ${t('renameHint')}`}
                          onClick={() => selectPlot(dataframeIndex, frameIndex)}
                          onDoubleClick={() => {
                            selectPlot(dataframeIndex, frameIndex)
                            setTabRename({ type: 'frame', index: frameIndex, value: frameName })
                          }}
                          {...middleClickOpens(() => openTabWithSelection(dataframeIndex, frameIndex))}
                        >
                          {frameName}
                        </button>
                        {missing > 0 ? (
                          <MissingBadge count={missing} title={t('missingCount', { count: missing })} ringClassName={active ? (shared ? 'ring-sky-200 dark:ring-sky-800' : 'ring-violet-200 dark:ring-violet-800') : 'ring-white dark:ring-zinc-950'} />
                        ) : null}
                      </span>
                    )}
                    <span className={`items-center ${active ? 'flex' : 'hidden group-hover:flex group-focus-within:flex'}`}>
                      <button type="button" className={iconButtonClassName} onClick={() => duplicateFrame(dataframeIndex, frameIndex)} title={t('duplicatePlot')} aria-label={t('duplicatePlot')}>⧉</button>
                      <button type="button" className={iconButtonClassName} onClick={() => removeFrame(dataframeIndex, frameIndex)} disabled={df.frames.length <= 1} title={t('removePlot')} aria-label={t('removePlot')}>✕</button>
                    </span>
                  </div>
                )
              })}
              <span className="relative">
                {drop?.dataframe === dataframeIndex && drop.index === df.frames.length ? dropLine : null}
                <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100" onClick={() => addFrame(dataframeIndex)} title={`${t('addPlot')} · ${dataframeName}`} aria-label={`${t('addPlot')} · ${dataframeName}`}>+</button>
              </span>
            </div>
          </div>
        )
      })}
      <button type="button" className="h-8 shrink-0 rounded-md border border-dashed border-zinc-400 px-2.5 text-xs text-zinc-600 hover:border-zinc-600 hover:text-zinc-900 dark:border-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-100" onClick={addDataframe} title={t('addDataset')}>
        + {t('datasetLabel')}
      </button>
      </div>
      <Button type="button" size="sm" className="shrink-0" onClick={onGenerateAll} disabled={includedCount === 0} title={t('generateAllHint')}>
        {t('generateAllCount', { count: includedCount })}
      </Button>
    </div>
  )
}
