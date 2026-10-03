import type { DataframeConfig, PlotConfig } from '../config/defaultPlotConfig'

export type SourceMode = 'teable' | 'file' | 'dataset'
/** `count`: shown after the label, e.g. the rows with a value of an axis column. */
export type MultiOption = { value: string; label: string; count?: number }

/** Name of a dataframe (a dataset in the UI); unnamed ones are numbered ("Dataset 1"). */
export const DATAFRAME_NAME_PREFIX = 'Dataset'
export const dataframeLabel = (dataframe: { name?: string }, index: number): string => dataframe.name?.trim() || `${DATAFRAME_NAME_PREFIX} ${index + 1}`
/** Name of a frame (a plot in the UI); unnamed ones are numbered ("Plot 1"). */
export const FRAME_NAME_PREFIX = 'Plot'
export const frameLabel = (frame: { name?: string }, index: number): string => frame.name || `${FRAME_NAME_PREFIX} ${index + 1}`

/** Default name for a new dataframe: "Dataset n" with n at least its position, skipping names in use. */
export const nextDataframeName = (dataframes: Array<{ name?: string }>): string => {
  const used = new Set(dataframes.map((dataframe, index) => dataframeLabel(dataframe, index)))
  let number = dataframes.length + 1
  while (used.has(`${DATAFRAME_NAME_PREFIX} ${number}`)) number += 1
  return `${DATAFRAME_NAME_PREFIX} ${number}`
}

export const numberValue = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback)
/** A typed number that must be greater than 0 (sizes); anything else keeps `fallback`. */
export const positiveValue = (value: number, fallback: number): number => (Number.isFinite(value) && value > 0 ? value : fallback)

const parseDecimal = (text: string): number => Number(text.trim().replace(',', '.'))

/** "16:9", "16/9", "16 x 9" or a single ratio such as "1.5"; undefined unless both parts are positive. */
export const parseAspectRatio = (text: string): [number, number] | undefined => {
  const parts = text.trim() === '' ? [] : text.split(/\s*[:/x×]\s*/i)
  const numbers = parts.map(parseDecimal)
  if (numbers.length === 1) numbers.push(1)
  return numbers.length === 2 && numbers.every((value) => Number.isFinite(value) && value > 0) ? [numbers[0], numbers[1]] : undefined
}
export const formatAspectRatio = ([width, height]: [number, number]): string => `${width}:${height}`
/** 6:4 and 3:2 are the same ratio. */
export const isSameAspectRatio = (a: [number, number], b: [number, number]): boolean => Math.abs(a[0] * b[1] - a[1] * b[0]) < 1e-9 * Math.max(1, a[0] * b[1])

/** A whole number greater than 0, e.g. a resolution in dpi. */
export const parsePositiveInteger = (text: string): number | undefined => {
  const value = parseDecimal(text)
  return text.trim() !== '' && Number.isInteger(value) && value > 0 ? value : undefined
}

export const parseColumnsFromImportResult = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map((entry) => entry.trim()))]
  }
  if (value && typeof value === 'object') {
    const fromKeys = Object.keys(value)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
    if (fromKeys.length > 0) {
      return [...new Set(fromKeys)]
    }
  }
  return []
}

export const moveItem = <T,>(items: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items
  }
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export const getAxisBasesFromColumns = (columns: string[]): string[] => {
  const buckets = new Map<string, Set<'low' | 'high' | 'unit'>>()

  for (const raw of columns) {
    const column = raw.trim()
    if (column.endsWith(' low')) {
      const base = column.slice(0, -4).trim()
      buckets.set(base, new Set([...(buckets.get(base) ?? []), 'low']))
    } else if (column.endsWith(' high')) {
      const base = column.slice(0, -5).trim()
      buckets.set(base, new Set([...(buckets.get(base) ?? []), 'high']))
    } else if (column.endsWith(' unit')) {
      const base = column.slice(0, -5).trim()
      buckets.set(base, new Set([...(buckets.get(base) ?? []), 'unit']))
    }
  }

  return [...buckets.entries()]
    // The plot reads "<name> low" and "<name> high"; a "<name> unit" column is optional.
    .filter(([, suffixes]) => suffixes.has('low') && suffixes.has('high'))
    .map(([base]) => base)
    .sort((a, b) => a.localeCompare(b))
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const getNextTabName = (names: Array<string | undefined>, prefix: string): string => {
  const usedNumbers = new Set<number>()
  const prefixPattern = escapeRegExp(prefix)
  for (const entry of names) {
    const value = entry?.trim()
    if (!value) continue
    const match = value.match(new RegExp(`^${prefixPattern}\\s+(\\d+)$`, 'i'))
    if (match) {
      usedNumbers.add(Number(match[1]))
    }
  }

  let candidate = 1
  while (usedNumbers.has(candidate)) {
    candidate += 1
  }
  return `${prefix} ${candidate}`
}

export const getSelectedIndices = (length: number, value: true | number[]): number[] =>
  value === true
    ? Array.from({ length }, (_, index) => index)
    : [...new Set(value.filter((entry) => Number.isInteger(entry) && entry >= 0 && entry < length))]

export const toggleIndexSelection = (length: number, value: true | number[], index: number, enabled: boolean): true | number[] => {
  const selected = new Set(getSelectedIndices(length, value))
  if (enabled) {
    selected.add(index)
  } else {
    selected.delete(index)
  }
  if (selected.size === length) {
    return true
  }
  return [...selected].sort((a, b) => a - b)
}

export const insertSelectionIndex = (length: number, value: true | number[], index: number): true | number[] => {
  if (value === true) return true
  const shifted = value.map((entry) => (entry >= index ? entry + 1 : entry))
  return getSelectedIndices(length, shifted)
}

export const removeSelectionIndex = (length: number, value: true | number[], index: number): true | number[] => {
  if (value === true) {
    return length === 0 ? [] : true
  }
  const shifted = value
    .filter((entry) => entry !== index)
    .map((entry) => (entry > index ? entry - 1 : entry))
  if (shifted.length === length && length > 0) {
    return true
  }
  return shifted
}

export const reorderSelectionIndices = (length: number, value: true | number[], from: number, to: number): true | number[] => {
  if (value === true) return true
  const moved = value.map((entry) => {
    if (entry === from) return to
    if (from < to && entry > from && entry <= to) return entry - 1
    if (from > to && entry >= to && entry < from) return entry + 1
    return entry
  })
  const normalized = getSelectedIndices(length, moved)
  return normalized.length === length && length > 0 ? true : normalized
}

export const getConfigLanguages = (config: PlotConfig): string[] => {
  const languages = new Set<string>()
  for (const dataframe of config.dataframes) {
    dataframe.plotLanguages.forEach((entry) => entry && languages.add(entry))
    languages.add(dataframe.language)
    Object.keys(dataframe.legendTitle).forEach((entry) => entry && languages.add(entry))
    dataframe.axes.forEach((axis) => Object.keys(axis.labels).forEach((entry) => entry && languages.add(entry)))
    dataframe.frames.forEach((frame) => Object.keys(frame.title).forEach((entry) => entry && languages.add(entry)))
  }
  return [...languages].sort((a, b) => a.localeCompare(b))
}

export const getConfigAxisColumns = (config: PlotConfig): string[] =>
  [...new Set(config.dataframes.flatMap((df) => df.axes.flatMap((axis) => axis.columns)))].sort((a, b) => a.localeCompare(b))

export const getConfigWhitelistKeywords = (config: PlotConfig): string[] => {
  const fromLayers = config.dataframes.flatMap((df) => df.frames.flatMap((frame) => frame.layers.flatMap((layer) => layer.whitelist ?? [])))
  const fromAxisColumns = getAxisBasesFromColumns(getConfigAxisColumns(config))
  return [...new Set([...fromLayers, ...fromAxisColumns])].sort((a, b) => a.localeCompare(b))
}

export const getSourceMode = (dataframe: DataframeConfig, availableDatasets: string[] = []): SourceMode =>
  dataframe._extensions.source_mode === 'teable' || dataframe._extensions.source_mode === 'file' || dataframe._extensions.source_mode === 'dataset'
    ? dataframe._extensions.source_mode
    : dataframe._extensions.sourceMode === 'teable' || dataframe._extensions.sourceMode === 'file' || dataframe._extensions.sourceMode === 'dataset'
      ? dataframe._extensions.sourceMode
      : dataframe.teableUrl || dataframe.apiKey
        ? 'teable'
        : dataframe.importFileName && availableDatasets.includes(dataframe.importFileName)
          ? 'dataset'
          : 'file'

let nextUiKey = 0
// Keys are persisted with the config (sessionStorage, tab sync), so a plain counter would collide
// with stored keys after a reload. The per-page-load prefix keeps newly created keys unique.
const uiKeySessionPrefix = Math.random().toString(36).slice(2, 8)

type UiKeyOwner = { _extensions: Record<string, unknown> }

export const createUiKey = (prefix: string): string => `${prefix}-${uiKeySessionPrefix}-${nextUiKey += 1}`

export const getUiKey = (owner: UiKeyOwner, prefix: string): string => {
  const existing = owner._extensions.uiKey
  if (typeof existing === 'string' && existing.length > 0) return existing
  const uiKey = createUiKey(prefix)
  owner._extensions.uiKey = uiKey
  return uiKey
}

export const refreshUiKey = (owner: UiKeyOwner, prefix: string): void => {
  owner._extensions.uiKey = createUiKey(prefix)
}

/**
 * Gives every dataframe and frame a unique UI key up front, so rendering never has to mutate the
 * config. Duplicates (e.g. a block copy-pasted in the JSON editor) get a fresh key.
 */
export const ensureUiKeys = (config: PlotConfig): PlotConfig => {
  const seen = new Set<string>()
  const ensure = (owner: UiKeyOwner, prefix: string) => {
    if (seen.has(getUiKey(owner, prefix))) refreshUiKey(owner, prefix)
    seen.add(getUiKey(owner, prefix))
  }
  for (const dataframe of config.dataframes) {
    ensure(dataframe, 'dataframe')
    dataframe.frames.forEach((frame) => ensure(frame, 'frame'))
  }
  return config
}

/** Re-keys per-dataframe state stored by UI key to the current dataframe positions. */
export const byDataframeIndex = <T,>(dataframeKeys: string[], byKey: Record<string, T>): Record<number, T> => {
  const result: Record<number, T> = {}
  dataframeKeys.forEach((key, index) => {
    if (key in byKey) result[index] = byKey[key]
  })
  return result
}

/** Where a plot is: its dataframe and its position among the dataframe's frames. */
export type FramePosition = { dataframeIndex: number; frameIndex: number }

/**
 * Moves a plot to `targetIndex` (0 … number of plots; the plot is placed before the one currently
 * there) of the same or another dataframe. The plot keeps its "include" state. A dataframe keeps
 * at least one plot. Returns null when nothing changes.
 */
export const moveFrameInConfig = (
  config: PlotConfig,
  sourceDataframeIndex: number,
  sourceFrameIndex: number,
  targetDataframeIndex: number,
  targetIndex: number,
): { config: PlotConfig; position: FramePosition } | null => {
  const source = config.dataframes[sourceDataframeIndex]
  const target = config.dataframes[targetDataframeIndex]
  const frame = source?.frames[sourceFrameIndex]
  if (!source || !target || !frame) return null
  if (sourceDataframeIndex === targetDataframeIndex) {
    const to = Math.min(targetIndex > sourceFrameIndex ? targetIndex - 1 : targetIndex, source.frames.length - 1)
    if (to === sourceFrameIndex || to < 0) return null
    const frames = moveItem(source.frames, sourceFrameIndex, to)
    return {
      config: {
        ...config,
        dataframes: config.dataframes.map((df, index) => (index === sourceDataframeIndex
          ? { ...df, frames, createAllFrames: reorderSelectionIndices(frames.length, df.createAllFrames, sourceFrameIndex, to) }
          : df)),
      },
      position: { dataframeIndex: sourceDataframeIndex, frameIndex: to },
    }
  }
  if (source.frames.length <= 1) return null
  const included = getSelectedIndices(source.frames.length, source.createAllFrames).includes(sourceFrameIndex)
  const insertAt = Math.min(Math.max(targetIndex, 0), target.frames.length)
  return {
    config: {
      ...config,
      dataframes: config.dataframes.map((df, index) => {
        if (index === sourceDataframeIndex) {
          const frames = df.frames.filter((_, frameIndex) => frameIndex !== sourceFrameIndex)
          return { ...df, frames, createAllFrames: removeSelectionIndex(frames.length, df.createAllFrames, sourceFrameIndex) }
        }
        if (index === targetDataframeIndex) {
          const frames = [...df.frames.slice(0, insertAt), frame, ...df.frames.slice(insertAt)]
          const shifted = insertSelectionIndex(frames.length, df.createAllFrames, insertAt)
          return { ...df, frames, createAllFrames: toggleIndexSelection(frames.length, shifted, insertAt, included) }
        }
        return df
      }),
    },
    position: { dataframeIndex: targetDataframeIndex, frameIndex: insertAt },
  }
}

/** Copies a plot of a dataframe right after the original, with a new name and the original's include state. */
export const duplicateFrameInDataframe = (df: DataframeConfig, index: number): { dataframe: DataframeConfig; frameIndex: number } | null => {
  const original = df.frames[index]
  if (!original) return null
  const clone = structuredClone(original)
  clone.name = getNextTabName(df.frames.map(frameLabel), FRAME_NAME_PREFIX)
  refreshUiKey(clone, 'frame')
  const included = getSelectedIndices(df.frames.length, df.createAllFrames).includes(index)
  const frames = [...df.frames]
  frames.splice(index + 1, 0, clone)
  const shifted = insertSelectionIndex(frames.length, df.createAllFrames, index + 1)
  return { dataframe: { ...df, frames, createAllFrames: toggleIndexSelection(frames.length, shifted, index + 1, included) }, frameIndex: index + 1 }
}

/** A new dataset: a copy of the first one's settings with a single plot (its first), under the next free name. */
export const newDataframeFrom = (dataframes: DataframeConfig[]): DataframeConfig => {
  const source = structuredClone(dataframes[0])
  source.name = nextDataframeName(dataframes)
  refreshUiKey(source, 'dataframe')
  const frame = { ...source.frames[0], name: frameLabel({}, 0) }
  refreshUiKey(frame, 'frame')
  return { ...source, frames: [frame], createAllFrames: true }
}

/** Tag of a value on a plot axis inside a field group, e.g. "X · Density". */
export const axisTag = (axis: 'x' | 'y', quantity?: string) => (quantity ? `${axis.toUpperCase()} · ${quantity}` : axis.toUpperCase())
