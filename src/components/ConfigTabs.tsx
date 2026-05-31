import type { Dispatch, DragEvent, MouseEvent, SetStateAction } from 'react'
import type { DataframeConfig, PlotConfig } from '../config/defaultPlotConfig'
import { getSelectedIndices, getUiKey } from '../utils/appState'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'

type TabRename = { type: 'dataframe' | 'frame'; index: number; value: string }

type Props = {
  activeDataframe: DataframeConfig
  activeDataframeIndex: number
  activeFrameIndex: number
  addDataframe: () => void
  addFrame: () => void
  applyTabRename: () => void
  dataframeDropIndex: number | null
  draggedDataframeIndex: number | null
  draggedFrameIndex: number | null
  duplicateDataframe: (index: number) => void
  duplicateFrame: (index: number) => void
  frameDropIndex: number | null
  moveFrameTargetDataframe: string
  moveFrameToDataframe: (sourceDataframeIndex: number, sourceFrameIndex: number, targetDataframeIndex: number) => void
  openTabWithSelection: (dataframeIndex: number, frameIndex: number) => void
  plotConfig: PlotConfig
  removeDataframe: (index: number) => void
  removeFrame: (index: number) => void
  reorderDataframes: (from: number, to: number) => void
  reorderFrames: (from: number, to: number) => void
  setActiveDataframeIndex: Dispatch<SetStateAction<number>>
  setActiveFrameIndex: Dispatch<SetStateAction<number>>
  setDataframeDropIndex: Dispatch<SetStateAction<number | null>>
  setDraggedDataframeIndex: Dispatch<SetStateAction<number | null>>
  setDraggedFrameIndex: Dispatch<SetStateAction<number | null>>
  setExpandedAxisColumns: Dispatch<SetStateAction<Record<number, boolean>>>
  setFrameDropIndex: Dispatch<SetStateAction<number | null>>
  setMoveFrameTargetDataframe: Dispatch<SetStateAction<string>>
  setTabRename: Dispatch<SetStateAction<TabRename | null>>
  tabRename: TabRename | null
  t: (key: string) => string
  toggleDataframeGeneration: (index: number, enabled: boolean) => void
  toggleFrameGeneration: (index: number, enabled: boolean) => void
}

export function ConfigTabs(props: Props) {
  const {
    activeDataframe,
    activeDataframeIndex,
    activeFrameIndex,
    addDataframe,
    addFrame,
    applyTabRename,
    dataframeDropIndex,
    draggedDataframeIndex,
    draggedFrameIndex,
    duplicateDataframe,
    duplicateFrame,
    frameDropIndex,
    moveFrameTargetDataframe,
    moveFrameToDataframe,
    openTabWithSelection,
    plotConfig,
    removeDataframe,
    removeFrame,
    reorderDataframes,
    reorderFrames,
    setActiveDataframeIndex,
    setActiveFrameIndex,
    setDataframeDropIndex,
    setDraggedDataframeIndex,
    setDraggedFrameIndex,
    setExpandedAxisColumns,
    setFrameDropIndex,
    setMoveFrameTargetDataframe,
    setTabRename,
    tabRename,
    t,
    toggleDataframeGeneration,
    toggleFrameGeneration,
  } = props

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{t('dataframe')}</span>
        {plotConfig.dataframes.map((df, index) => (
          <div
            key={getUiKey(df, 'dataframe')}
            className="inline-flex items-center gap-2 transition-all duration-150"
            draggable
            onDragStart={() => setDraggedDataframeIndex(index)}
            onDragOver={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault()
              setDataframeDropIndex(index)
            }}
            onDrop={() => {
              if (draggedDataframeIndex !== null) {
                reorderDataframes(draggedDataframeIndex, index)
              }
              setDraggedDataframeIndex(null)
              setDataframeDropIndex(null)
            }}
            onDragEnd={() => {
              setDraggedDataframeIndex(null)
              setDataframeDropIndex(null)
            }}
          >
            {draggedDataframeIndex !== null && dataframeDropIndex === index ? (
              <div className="h-8 w-8 rounded-md border-2 border-dashed border-violet-400 bg-violet-100/70 transition-all dark:bg-violet-900/30" />
            ) : null}
            {tabRename?.type === 'dataframe' && tabRename.index === index ? (
              <Input
                autoFocus
                value={tabRename.value}
                onChange={(event) => setTabRename((current) => (current ? { ...current, value: event.target.value } : current))}
                onBlur={applyTabRename}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyTabRename()
                  if (event.key === 'Escape') setTabRename(null)
                }}
                className="h-8 w-36"
              />
            ) : (
              <div
                role="button"
                tabIndex={0}
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${activeDataframeIndex === index
                    ? 'border-violet-500 bg-violet-100 dark:bg-violet-900/30'
                    : 'border-input bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                onClick={() => { setActiveDataframeIndex(index); setActiveFrameIndex(0); setExpandedAxisColumns({}) }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveDataframeIndex(index)
                    setActiveFrameIndex(0)
                    setExpandedAxisColumns({})
                  }
                }}
                onDoubleClick={() => setTabRename({ type: 'dataframe', index, value: df.name || `Dataframe ${index + 1}` })}
                onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
                  if (event.button === 1) {
                    event.preventDefault()
                    openTabWithSelection(index, 0)
                  }
                }}
              >
                {df.name || `Dataframe ${index + 1}`}
                <span className="inline-flex items-center gap-1 text-[11px]" title="Include this dataframe when generating all plots.">
                  <input
                    type="checkbox"
                    checked={getSelectedIndices(plotConfig.dataframes.length, plotConfig.createAllDataframes).includes(index)}
                    onChange={(event) => {
                      event.stopPropagation()
                      toggleDataframeGeneration(index, event.target.checked)
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                </span>
                <button
                  type="button"
                  className="rounded px-1 text-xs leading-none hover:bg-green-600 aspect-square"
                  onClick={(event) => {
                    event.stopPropagation()
                    duplicateDataframe(index)
                  }}
                  title="Duplicate dataframe"
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-xs leading-none hover:bg-red-500 aspect-square"
                  onClick={(event) => {
                    event.stopPropagation()
                    removeDataframe(index)
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
        <Button size="sm" onClick={addDataframe}>+</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <span className="text-sm font-semibold">{t('frame')}</span>
        {activeDataframe.frames.map((frame, index) => (
          <div
            key={getUiKey(frame, 'frame')}
            className="inline-flex items-center gap-2 transition-all duration-150"
            draggable
            onDragStart={() => setDraggedFrameIndex(index)}
            onDragOver={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault()
              setFrameDropIndex(index)
            }}
            onDrop={() => {
              if (draggedFrameIndex !== null) {
                reorderFrames(draggedFrameIndex, index)
              }
              setDraggedFrameIndex(null)
              setFrameDropIndex(null)
            }}
            onDragEnd={() => {
              setDraggedFrameIndex(null)
              setFrameDropIndex(null)
            }}
          >
            {draggedFrameIndex !== null && frameDropIndex === index ? (
              <div className="h-8 w-8 rounded-md border-2 border-dashed border-violet-400 bg-violet-100/70 transition-all dark:bg-violet-900/30" />
            ) : null}
            {tabRename?.type === 'frame' && tabRename.index === index ? (
              <Input
                autoFocus
                value={tabRename.value}
                onChange={(event) => setTabRename((current) => (current ? { ...current, value: event.target.value } : current))}
                onBlur={applyTabRename}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyTabRename()
                  if (event.key === 'Escape') setTabRename(null)
                }}
                className="h-8 w-28"
              />
            ) : (
              <div
                role="button"
                tabIndex={0}
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${activeFrameIndex === index
                    ? 'border-violet-500 bg-violet-100 dark:bg-violet-900/30'
                    : 'border-input bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                onClick={() => setActiveFrameIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveFrameIndex(index)
                  }
                }}
                onDoubleClick={() => setTabRename({ type: 'frame', index, value: frame.name || `Frame ${index + 1}` })}
                onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
                  if (event.button === 1) {
                    event.preventDefault()
                    openTabWithSelection(activeDataframeIndex, index)
                  }
                }}
              >
                {frame.name || `Frame ${index + 1}`}
                <span className="inline-flex items-center gap-1 text-[11px]" title="Include this frame when generating all plots.">
                  <input
                    type="checkbox"
                    checked={getSelectedIndices(activeDataframe.frames.length, activeDataframe.createAllFrames).includes(index)}
                    onChange={(event) => {
                      event.stopPropagation()
                      toggleFrameGeneration(index, event.target.checked)
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                </span>
                <button
                  type="button"
                  className="rounded px-1 text-xs leading-none hover:bg-green-600 aspect-square"
                  onClick={(event) => {
                    event.stopPropagation()
                    duplicateFrame(index)
                  }}
                  title="Duplicate frame"
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-xs leading-none hover:bg-red-500 aspect-square"
                  onClick={(event) => {
                    event.stopPropagation()
                    removeFrame(index)
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
        <Button size="sm" onClick={addFrame}>+</Button>
        <div className="ml-2 flex items-center gap-2">
          <Select value={moveFrameTargetDataframe} onChange={(event) => setMoveFrameTargetDataframe(event.target.value)}>
            {plotConfig.dataframes.map((dataframe, index) => (
              <option key={getUiKey(dataframe, 'dataframe')} value={index}>
                {dataframe.name || `Dataframe ${index + 1}`}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => moveFrameToDataframe(activeDataframeIndex, activeFrameIndex, Number(moveFrameTargetDataframe))}
            disabled={plotConfig.dataframes.length <= 1}
          >
            Move frame
          </Button>
        </div>
      </div>
    </section>
  )
}
