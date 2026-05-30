import type { DataframeConfig, PlotConfig } from '../config/defaultPlotConfig'

export type SourceMode = 'teable' | 'file'
export type JsonRenderTarget = { dataframeIndex: number; frameIndex: number }
export type MultiOption = { value: string; label: string }

export const WHITELIST_OPTIONS: MultiOption[] = []

export const numberValue = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback)

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
    .filter(([, suffixes]) => suffixes.has('low') && suffixes.has('high') && suffixes.has('unit'))
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

export const buildJsonFrameNeedle = (config: PlotConfig, target: JsonRenderTarget): string | null => {
  const frame = config.dataframes[target.dataframeIndex]?.frames[target.frameIndex]
  if (!frame) return null
  const snippet = JSON.stringify(frame, null, 2).trim()
  const lines = snippet.split('\n')
  return lines.length > 2 ? lines.slice(1, -1).join('\n') : snippet
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

export const getSourceMode = (dataframe: DataframeConfig): SourceMode =>
  dataframe._extensions.sourceMode === 'teable' || dataframe._extensions.sourceMode === 'file'
    ? dataframe._extensions.sourceMode
    : dataframe.teableUrl || dataframe.apiKey
      ? 'teable'
      : 'file'
