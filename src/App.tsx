import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { PlotPage } from './components/PlotPage'
import { Alert } from './components/ui/alert'
import { Button } from './components/ui/button'
import { normalizePlotConfig } from './config/configMappers'
import { AXIS_MODES, PLOT_ALGORITHMS, createDefaultPlotConfig, type AxisConfig, type DataframeConfig, type FrameConfig, type GuidelineConfig, type PlotConfig } from './config/defaultPlotConfig'
import { exportConfig, parseImportedConfig, toExternalConfig } from './utils/configIo'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import { UI_LABELS, FIELD_DESCRIPTIONS, type UILanguage } from './uiTranslations'
import { AppPopouts } from './components/AppPopouts'
import { AxesSection, addAxisToDataframe, updateAxisInDataframe } from './components/AxesSection'
import { LayersSection, addLayerToFrame } from './components/LayersSection'
import { MaterialColorsSection, generateMaterialColorsForDataframe } from './components/MaterialColorsSection'
import { GuidelinesSection, addGuidelineToFrame, updateGuidelineInFrame } from './components/GuidelinesSection'
import { AnnotationsSection } from './components/AnnotationsSection'
import { ColoredAreasSection } from './components/ColoredAreasSection'
import { FrameSection } from './components/FrameSection'
import { AdvancedJsonSection } from './components/AdvancedJsonSection'
import { DataframeSection } from './components/DataframeSection'

type AppPage = 'config' | 'plot'
type AlertTone = 'success' | 'error'
interface AlertState { tone: AlertTone; message: string }
type SourceMode = 'teable' | 'file'
type JsonRenderTarget = { dataframeIndex: number; frameIndex: number }
type PlotAction = 'preview-current' | 'create-all'

type MultiOption = { value: string; label: string }
type ImportDatabaseResponse = {
  columns?: string[]
  keywords_by_column?: Record<string, string[]>
  import_file_name?: string
  message?: string
  success?: boolean
}

const WHITELIST_OPTIONS: MultiOption[] = []


const numberValue = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback)
const parseColumnsFromImportResult = (value: unknown): string[] => {
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

const moveItem = <T,>(items: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items
  }
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

const getAxisBasesFromColumns = (columns: string[]): string[] => {
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

const getNextTabName = (names: Array<string | undefined>, prefix: string): string => {
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

const getSelectedIndices = (length: number, value: true | number[]): number[] =>
  value === true
    ? Array.from({ length }, (_, index) => index)
    : [...new Set(value.filter((entry) => Number.isInteger(entry) && entry >= 0 && entry < length))]

const toggleIndexSelection = (length: number, value: true | number[], index: number, enabled: boolean): true | number[] => {
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

const insertSelectionIndex = (length: number, value: true | number[], index: number): true | number[] => {
  if (value === true) return true
  const shifted = value.map((entry) => (entry >= index ? entry + 1 : entry))
  return getSelectedIndices(length, shifted)
}

const removeSelectionIndex = (length: number, value: true | number[], index: number): true | number[] => {
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

const reorderSelectionIndices = (length: number, value: true | number[], from: number, to: number): true | number[] => {
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

const buildJsonFrameNeedle = (config: PlotConfig, target: JsonRenderTarget): string | null => {
  const frame = config.dataframes[target.dataframeIndex]?.frames[target.frameIndex]
  if (!frame) return null
  const snippet = JSON.stringify(frame, null, 2).trim()
  const lines = snippet.split('\n')
  return lines.length > 2 ? lines.slice(1, -1).join('\n') : snippet
}

const getConfigLanguages = (config: PlotConfig): string[] => {
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

const getConfigWhitelistKeywords = (config: PlotConfig): string[] => {
  const fromLayers = config.dataframes.flatMap((df) => df.frames.flatMap((frame) => frame.layers.flatMap((layer) => layer.whitelist ?? [])))
  const fromAxisColumns = getAxisBasesFromColumns(getConfigAxisColumns(config))
  return [...new Set([...fromLayers, ...fromAxisColumns])].sort((a, b) => a.localeCompare(b))
}

const getConfigAxisColumns = (config: PlotConfig): string[] =>
  [...new Set(config.dataframes.flatMap((df) => df.axes.flatMap((axis) => axis.columns)))].sort((a, b) => a.localeCompare(b))
const getSourceMode = (dataframe: DataframeConfig): SourceMode =>
  dataframe._extensions.sourceMode === 'teable' || dataframe._extensions.sourceMode === 'file'
    ? dataframe._extensions.sourceMode
    : dataframe.teableUrl || dataframe.apiKey
      ? 'teable'
      : 'file'

function Field({ label, jsonPath, selfClassName, className, language, children }: { label: string; jsonPath: string; selfClassName?: string; className?: string; language: UILanguage; children: ReactNode }) {
  const description = FIELD_DESCRIPTIONS[language].find((entry) => entry.match.test(jsonPath))?.description
  const tooltip = description ? `${jsonPath}\n${description}` : jsonPath
  return (
    <div className={`grid gap-2 ${selfClassName || ''}`}>
      <label title={tooltip} className="font-medium text-zinc-900 dark:text-zinc-100">{label}</label>
      <div className={`grid gap-2 ${className || ''}`}>
        {children}
      </div>
    </div>
  )
}

function MultiSelectInput({
  value,
  options,
  title,
  onChange,
  expanded = false,
  onToggleExpanded,
  hideModeToggle = false,
  modeValue,
  onModeChange,
}: {
  value: string[]
  options: MultiOption[]
  title: string
  onChange: (next: string[]) => void
  expanded?: boolean
  onToggleExpanded?: () => void
  hideModeToggle?: boolean
  modeValue?: boolean
  onModeChange?: (next: boolean) => void
}) {
  const selected = new Set(value)
  const allSelected = options.length > 0 && value.length === options.length
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const visibleOptions = normalizedSearch.length === 0
    ? options
    : options.filter((option) => option.label.toLowerCase().includes(normalizedSearch) || option.value.toLowerCase().includes(normalizedSearch))

  return (
    <div className="grid gap-2 h-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setShowSearch((current) => !current)}>
            {showSearch ? 'Hide search' : 'Search'}
          </Button>
          {!hideModeToggle && onModeChange ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onModeChange(!(modeValue ?? false))}>
              {modeValue ? 'Whitelist' : 'Blacklist'}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(allSelected ? [] : options.map((entry) => entry.value))} disabled={options.length === 0}>
            {allSelected ? 'Deselect all' : 'Select all'}
          </Button>
          {onToggleExpanded ? (
            <Button type="button" size="sm" variant="outline" onClick={onToggleExpanded}>
              {expanded ? 'Collapse' : 'Expand'}
            </Button>
          ) : null}
        </div>
      </div>
      {showSearch ? (
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search options…"
        />
      ) : null}
      <div className={`${expanded ? 'h-full min-h-28' : 'h-47'} overflow-auto rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900`}>
        {visibleOptions.length > 0 ? (
          visibleOptions.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={selected.has(option.value)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...new Set([...value, option.value])]
                      : value.filter((entry) => entry !== option.value),
                  )
                }
              />
              <span>{option.label}</span>
            </label>
          ))
        ) : (
          <p className="m-0 py-1 text-sm text-zinc-500">{options.length === 0 ? 'No options available.' : 'No search results.'}</p>
        )}
      </div>
    </div>
  )
}

function RemoveIconButton({ onClick, onHoverChange }: { onClick: () => void; onHoverChange?: (hovered: boolean) => void }) {
  return (
    <Button type="button" size="sm" variant="outline" className="absolute right-2 top-2 h-7 px-2 hover:bg-red-500" onClick={onClick} onMouseEnter={() => onHoverChange?.(true)} onMouseLeave={() => onHoverChange?.(false)} aria-label="Remove">
      ✕
    </Button>
  )
}

function ColorOrMaterialInput({
  value,
  onChange,
  materialOptions,
}: {
  value: string
  onChange: (next: string) => void
  materialOptions: string[]
}) {
  const isHexColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
  const mode: 'custom' | 'existing' = isHexColor ? 'custom' : 'existing'
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2">
      <Button type="button" variant="outline" onClick={() => onChange(mode === 'custom' ? (materialOptions[0] ?? 'default') : '#000000')}>
        {mode}
      </Button>
      {mode === 'custom' ? (
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <Input type="color" value={isHexColor ? value : '#000000'} className="h-10 w-16 p-1" onChange={(e) => onChange(e.target.value)} />
          <Input value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      ) : (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          {materialOptions.map((materialOption) => (
            <option key={materialOption} value={materialOption}>{materialOption}</option>
          ))}
        </Select>
      )}
    </div>
  )
}

const FONT_STYLE_OPTIONS: Array<DataframeConfig['font']['fontStyle']> = ['serif', 'sans-serif', 'cursive', 'fantasy', 'monospace']
const FONT_FAMILY_OPTIONS = ['DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New']
const CUSTOM_SELECT_VALUE = '__custom__'

function App() {
  const [plotConfig, setPlotConfig] = useState<PlotConfig>(() => createDefaultPlotConfig())
  const [configBaseName, setConfigBaseName] = useState('ashby-config')
  const [activePage, setActivePage] = useState<AppPage>('config')
  const [activeDataframeIndex, setActiveDataframeIndex] = useState(0)
  const [activeFrameIndex, setActiveFrameIndex] = useState(0)
  const [hoveredRemoveGroup, setHoveredRemoveGroup] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [jsonDraft, setJsonDraft] = useState('')
  const [alert, setAlert] = useState<AlertState | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const jsonTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const jsonOverlayRef = useRef<HTMLPreElement | null>(null)
  const [plotLanguageDraft, setPlotLanguageDraft] = useState('')
  const [uiLanguage, setUiLanguage] = useState<UILanguage>('en')
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [availableWhitelistKeywords, setAvailableWhitelistKeywords] = useState<MultiOption[]>(WHITELIST_OPTIONS)
  const [availableKeywordsByColumn, setAvailableKeywordsByColumn] = useState<Record<string, string[]>>({})
  const [importInProgress, setImportInProgress] = useState(false)
  const [tabRename, setTabRename] = useState<{ type: 'dataframe' | 'frame'; index: number; value: string } | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showGenerateColorsConfirm, setShowGenerateColorsConfirm] = useState(false)
  const [draggedDataframeIndex, setDraggedDataframeIndex] = useState<number | null>(null)
  const [draggedFrameIndex, setDraggedFrameIndex] = useState<number | null>(null)
  const [dataframeDropIndex, setDataframeDropIndex] = useState<number | null>(null)
  const [frameDropIndex, setFrameDropIndex] = useState<number | null>(null)
  const [moveFrameTargetDataframe, setMoveFrameTargetDataframe] = useState<string>('0')
  const [jsonFullscreen, setJsonFullscreen] = useState(false)
  const [expandedAxisColumns, setExpandedAxisColumns] = useState<Record<number, boolean>>({})
  const [expandedLayerKeywords, setExpandedLayerKeywords] = useState<Record<number, boolean>>({})
  const [importedDatabaseStatus, setImportedDatabaseStatus] = useState<Record<number, { imported: boolean; source: SourceMode }>>({})
  const [plotActionNonce, setPlotActionNonce] = useState(0)
  const [plotAction, setPlotAction] = useState<PlotAction>('preview-current')
  const [customMaterialNames, setCustomMaterialNames] = useState<Record<string, string>>({})

  const activeDataframe = plotConfig.dataframes[activeDataframeIndex] ?? plotConfig.dataframes[0]
  const materialColorOptions = Object.keys(activeDataframe.materialColors)
  const activeFrame = activeDataframe.frames[activeFrameIndex] ?? activeDataframe.frames[0]
  const automaticDisplayAreaActive = activeFrame.automaticDisplayAreaMargin !== null
  const sourceMode = getSourceMode(activeDataframe)
  const t = (key: string) => UI_LABELS[uiLanguage][key] ?? key
  const availableAxisColumns = useMemo(
    () => getAxisBasesFromColumns(availableColumns).map((column) => ({ value: column, label: column })),
    [availableColumns],
  )
  const layerNameOptions = useMemo(() => {
    if (availableColumns.length === 0) {
      return []
    }

    const excluded = new Set<string>()
    for (const axisBase of getAxisBasesFromColumns(availableColumns)) {
      excluded.add(`${axisBase} low`)
      excluded.add(`${axisBase} high`)
      excluded.add(`${axisBase} unit`)
    }

    return availableColumns
      .filter((column) => !excluded.has(column))
      .sort((a, b) => a.localeCompare(b))
      .map((column) => ({ value: column, label: column }))
  }, [availableColumns])
  const materialKeywordOptions = useMemo(() => {
    const layerColumns = new Set(
      activeDataframe.frames.flatMap((frame) =>
        frame.layers.map((layer) => layer.name?.trim()).filter((entry): entry is string => Boolean(entry)),
      ),
    )
    const keywords = new Set<string>()
    for (const column of layerColumns) {
      for (const keyword of availableKeywordsByColumn[column] ?? []) {
        const normalized = keyword.trim()
        if (normalized) {
          keywords.add(normalized)
        }
      }
    }
    return [...keywords].sort((a, b) => a.localeCompare(b))
  }, [activeDataframe.frames, availableKeywordsByColumn])

  useEffect(() => {
    patchActiveDataframe((df) => {
      const defaultColor = df.materialColors.default
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test((defaultColor ?? '').trim())) {
        return df
      }
      return {
        ...df,
        materialColors: {
          ...df.materialColors,
          default: '#000000',
        },
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDataframeIndex])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const df = Number(params.get('dataframe'))
    const frame = Number(params.get('frame'))
    if (Number.isInteger(df) && df >= 0) {
      setActiveDataframeIndex(df)
    }
    if (Number.isInteger(frame) && frame >= 0) {
      setActiveFrameIndex(frame)
    }
  }, [])

  useEffect(() => {
    const stored = window.sessionStorage.getItem('ashby-plot-config')
    if (!stored) return
    try {
      const parsed = parseImportedConfig(stored)
      const normalized = normalizePlotConfig(parsed)
      setPlotConfig(normalized)
    } catch {
      // ignore invalid cached config
    }
  }, [])

  useEffect(() => {
    window.sessionStorage.setItem('ashby-plot-config', JSON.stringify(toExternalConfig(plotConfig)))
  }, [plotConfig])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'ashby-plot-config' || !event.newValue) return
      try {
        const parsed = parseImportedConfig(event.newValue)
        const normalized = normalizePlotConfig(parsed)
        setPlotConfig(normalized)
      } catch {
        // ignore invalid incoming config
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('dataframe', String(activeDataframeIndex))
    params.set('frame', String(activeFrameIndex))
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [activeDataframeIndex, activeFrameIndex])

  useEffect(() => {
    if (!alert) return
    const timeout = window.setTimeout(() => setAlert(null), 15000)
    return () => window.clearTimeout(timeout)
  }, [alert])

  useEffect(() => {
    const keywords = getConfigWhitelistKeywords(plotConfig)
    setAvailableWhitelistKeywords(keywords.map((entry) => ({ value: entry, label: entry })))
  }, [plotConfig])

  useEffect(() => {
    const html = document.documentElement
    html.classList.remove('dark')
    html.style.colorScheme = 'light'
  }, [])

  useEffect(() => {
    setMoveFrameTargetDataframe(String(activeDataframeIndex))
  }, [activeDataframeIndex])

  useEffect(() => {
    if (!showJson) return
    const textarea = jsonTextareaRef.current
    const overlay = jsonOverlayRef.current
    if (!textarea) return
    const needle = buildJsonFrameNeedle(plotConfig, { dataframeIndex: activeDataframeIndex, frameIndex: activeFrameIndex })
    if (!needle) return
    const index = jsonDraft.indexOf(needle)
    if (index < 0) return
    textarea.focus()
    textarea.setSelectionRange(index, index)
    const before = jsonDraft.slice(0, index)
    const line = before.split('\n').length
    const lineHeight = 18
    const top = Math.max(0, (line - 6) * lineHeight)
    textarea.scrollTop = top
    if (overlay) {
      overlay.scrollTop = top
    }
  }, [showJson, activeDataframeIndex, activeFrameIndex, jsonDraft, plotConfig])

  const patchDataframe = (index: number, patch: (current: DataframeConfig) => DataframeConfig) => {
    setPlotConfig((current) => ({ ...current, dataframes: current.dataframes.map((df, i) => (i === index ? patch(df) : df)) }))
  }
  const patchActiveDataframe = (patch: (current: DataframeConfig) => DataframeConfig) => patchDataframe(activeDataframeIndex, patch)
  const patchActiveFrame = (patch: (current: FrameConfig) => FrameConfig) => {
    patchActiveDataframe((df) => ({ ...df, frames: df.frames.map((frame, i) => (i === activeFrameIndex ? patch(frame) : frame)) }))
  }
  const toggleDataframeGeneration = (index: number, enabled: boolean) => {
    setPlotConfig((current) => ({ ...current, createAllDataframes: toggleIndexSelection(current.dataframes.length, current.createAllDataframes, index, enabled) }))
  }
  const toggleFrameGeneration = (index: number, enabled: boolean) => {
    patchActiveDataframe((df) => ({ ...df, createAllFrames: toggleIndexSelection(df.frames.length, df.createAllFrames, index, enabled) }))
  }

  const addDataframe = () => {
    setPlotConfig((current) => {
      const nextIndex = current.dataframes.length
      const source = structuredClone(current.dataframes[0])
      source.name = getNextTabName(current.dataframes.map((df, index) => df.name ?? `Dataframe ${index + 1}`), 'Dataframe')
      source.frames = source.frames.map((frame, frameIndex) => ({ ...frame, name: `Frame ${frameIndex + 1}` }))
      setActiveDataframeIndex(nextIndex)
      setActiveFrameIndex(0)
      const nextDataframes = [...current.dataframes, source]
      return {
        ...current,
        dataframes: nextDataframes,
        createAllDataframes: insertSelectionIndex(nextDataframes.length, current.createAllDataframes, nextIndex),
      }
    })
  }

  const addFrame = () => {
    patchActiveDataframe((df) => {
      const next = structuredClone(df.frames[0])
      next.name = getNextTabName(df.frames.map((frame) => frame.name), 'Frame')
      const nextFrames = [...df.frames, next]
      return { ...df, frames: nextFrames, createAllFrames: insertSelectionIndex(nextFrames.length, df.createAllFrames, nextFrames.length - 1) }
    })
    setActiveFrameIndex(activeDataframe.frames.length)
  }

  const duplicateDataframe = (index: number) => {
    setPlotConfig((current) => {
      const original = current.dataframes[index]
      if (!original) return current
      const clone = structuredClone(original)
      clone.name = getNextTabName(current.dataframes.map((df) => df.name), 'Dataframe')
      const nextDataframes = [...current.dataframes]
      nextDataframes.splice(index + 1, 0, clone)
      setActiveDataframeIndex(index + 1)
      setActiveFrameIndex(0)
      return {
        ...current,
        dataframes: nextDataframes,
        createAllDataframes: insertSelectionIndex(nextDataframes.length, current.createAllDataframes, index + 1),
      }
    })
  }

  const duplicateFrame = (index: number) => {
    patchActiveDataframe((df) => {
      const original = df.frames[index]
      if (!original) return df
      const clone = structuredClone(original)
      clone.name = getNextTabName(df.frames.map((frame) => frame.name), 'Frame')
      const nextFrames = [...df.frames]
      nextFrames.splice(index + 1, 0, clone)
      setActiveFrameIndex(index + 1)
      return { ...df, frames: nextFrames, createAllFrames: insertSelectionIndex(nextFrames.length, df.createAllFrames, index + 1) }
    })
  }

  const moveFrameToDataframe = (sourceDataframeIndex: number, sourceFrameIndex: number, targetDataframeIndex: number) => {
    if (sourceDataframeIndex === targetDataframeIndex) return
    setPlotConfig((current) => {
      const sourceDataframe = current.dataframes[sourceDataframeIndex]
      const targetDataframe = current.dataframes[targetDataframeIndex]
      if (!sourceDataframe || !targetDataframe || sourceDataframe.frames.length <= 1) {
        return current
      }
      const frameToMove = sourceDataframe.frames[sourceFrameIndex]
      if (!frameToMove) return current
      const nextDataframes = current.dataframes.map((df, index) => {
        if (index === sourceDataframeIndex) {
          const nextFrames = df.frames.filter((_, frameIndex) => frameIndex !== sourceFrameIndex)
          return { ...df, frames: nextFrames, createAllFrames: removeSelectionIndex(nextFrames.length, df.createAllFrames, sourceFrameIndex) }
        }
        if (index === targetDataframeIndex) {
          const nextFrames = [...df.frames, frameToMove]
          return { ...df, frames: nextFrames, createAllFrames: insertSelectionIndex(nextFrames.length, df.createAllFrames, nextFrames.length - 1) }
        }
        return df
      })
      setActiveDataframeIndex(targetDataframeIndex)
      setActiveFrameIndex(nextDataframes[targetDataframeIndex].frames.length - 1)
      return {
        ...current,
        dataframes: nextDataframes,
        createAllDataframes: current.createAllDataframes,
      }
    })
  }

  const removeDataframe = (index: number) => {
    setPlotConfig((current) => {
      if (current.dataframes.length <= 1) {
        return current
      }
      const nextDataframes = current.dataframes.filter((_, i) => i !== index)
      setActiveDataframeIndex((prev) => Math.max(0, Math.min(prev, nextDataframes.length - 1)))
      setActiveFrameIndex(0)
      return { ...current, dataframes: nextDataframes }
    })
  }

  const removeFrame = (index: number) => {
    patchActiveDataframe((df) => {
      if (df.frames.length <= 1) {
        return df
      }
      const nextFrames = df.frames.filter((_, i) => i !== index)
      setActiveFrameIndex((prev) => Math.max(0, Math.min(prev, nextFrames.length - 1)))
      return { ...df, frames: nextFrames, createAllFrames: removeSelectionIndex(nextFrames.length, df.createAllFrames, index) }
    })
  }

  const reorderDataframes = (from: number, to: number) => {
    setPlotConfig((current) => {
      const nextDataframes = moveItem(current.dataframes, from, to)
      return {
        ...current,
        dataframes: nextDataframes,
        createAllDataframes: reorderSelectionIndices(nextDataframes.length, current.createAllDataframes, from, to),
      }
    })
    if (activeDataframeIndex === from) {
      setActiveDataframeIndex(to)
    } else if (from < activeDataframeIndex && to >= activeDataframeIndex) {
      setActiveDataframeIndex((prev) => prev - 1)
    } else if (from > activeDataframeIndex && to <= activeDataframeIndex) {
      setActiveDataframeIndex((prev) => prev + 1)
    }
  }

  const reorderFrames = (from: number, to: number) => {
    patchActiveDataframe((df) => {
      const nextFrames = moveItem(df.frames, from, to)
      return { ...df, frames: nextFrames, createAllFrames: reorderSelectionIndices(nextFrames.length, df.createAllFrames, from, to) }
    })
    if (activeFrameIndex === from) {
      setActiveFrameIndex(to)
    } else if (from < activeFrameIndex && to >= activeFrameIndex) {
      setActiveFrameIndex((prev) => prev - 1)
    } else if (from > activeFrameIndex && to <= activeFrameIndex) {
      setActiveFrameIndex((prev) => prev + 1)
    }
  }

  const generateMaterialColors = () => {
    patchActiveDataframe((df) => generateMaterialColorsForDataframe(df))
    setShowGenerateColorsConfirm(false)
  }



  const addAxis = () => {
    patchActiveDataframe((df) => addAxisToDataframe(df))
  }

  const addLayer = () => {
    patchActiveFrame((frame) => addLayerToFrame(frame))
  }

  const addGuideline = () => {
    patchActiveFrame((frame) => addGuidelineToFrame(frame))
  }

  const updateAxis = (axisIndex: number, patch: (axis: AxisConfig) => AxisConfig) => {
    patchActiveDataframe((df) => updateAxisInDataframe(df, axisIndex, patch))
  }

  const updateGuideline = (guidelineIndex: number, patch: (guideline: GuidelineConfig) => GuidelineConfig) => {
    patchActiveFrame((frame) => updateGuidelineInFrame(frame, guidelineIndex, patch))
  }

  const removeAxis = (axisIndex: number) => {
    patchActiveDataframe((df) => {
      if (df.axes.length <= 1) {
        return df
      }
      const nextAxes = df.axes.filter((_, index) => index !== axisIndex)
      const fallbackAxis = nextAxes[0]?.name ?? ''
      return {
        ...df,
        axes: nextAxes,
        frames: df.frames.map((frame) => ({
          ...frame,
          xQuantity: nextAxes.some((axis) => axis.name === frame.xQuantity) ? frame.xQuantity : fallbackAxis,
          yQuantity: nextAxes.some((axis) => axis.name === frame.yQuantity) ? frame.yQuantity : fallbackAxis,
        })),
      }
    })
  }

  const importDatabase = async (file?: File) => {
    setImportInProgress(true)
    try {
      const response = await fetch('/api/import-database', {
        method: 'POST',
        headers: sourceMode === 'teable' ? { 'Content-Type': 'application/json' } : undefined,
        body:
          sourceMode === 'teable'
            ? JSON.stringify({
              API_Key: activeDataframe.apiKey,
              teable_url: activeDataframe.teableUrl,
              import_sheet: activeDataframe.importSheet,
            })
            : (() => {
              const form = new FormData()
              if (file) {
                form.append('file', file)
              }
              form.append('import_sheet', String(activeDataframe.importSheet))
              return form
            })(),
      })

      const payload = (await response.json().catch(() => ({}))) as ImportDatabaseResponse
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || `Import failed (${response.status}).`)
      }

      const columns = parseColumnsFromImportResult(payload.columns)
      const keywordsByColumn = payload.keywords_by_column ?? {}
      const axisBases = getAxisBasesFromColumns(columns)
      const suffixColumns = new Set<string>(axisBases.flatMap((base) => [`${base} low`, `${base} high`, `${base} unit`]))
      const allowedLayerColumns = new Set(columns.filter((column) => !suffixColumns.has(column)))
      const unknownColumns = new Set<string>()
      for (const axis of activeDataframe.axes) {
        for (const column of axis.columns) {
          if (!axisBases.includes(column)) {
            unknownColumns.add(column)
          }
        }
      }
      for (const layer of activeFrame.layers) {
        if (layer.name && !allowedLayerColumns.has(layer.name)) {
          unknownColumns.add(layer.name)
        }
      }
      patchActiveDataframe((df) => ({
        ...df,
        importFileName: file?.name ?? payload.import_file_name ?? df.importFileName,
        axes: df.axes.map((axis) => ({
          ...axis,
          columns: axis.columns.filter((column) => axisBases.includes(column)),
        })),
        frames: df.frames.map((frame) => ({
          ...frame,
          layers: frame.layers.map((layer) => ({
            ...layer,
            name: layer.name && allowedLayerColumns.has(layer.name) ? layer.name : undefined,
          })),
        })),
      }))
      setImportedDatabaseStatus((current) => ({
        ...current,
        [activeDataframeIndex]: { imported: true, source: sourceMode },
      }))
      setAvailableColumns(columns)
      setAvailableKeywordsByColumn(keywordsByColumn)
      setAvailableWhitelistKeywords(
        [...new Set([...activeDataframe.frames.flatMap((frame) => frame.layers.flatMap((layer) => layer.whitelist ?? []))])]
          .sort((a, b) => a.localeCompare(b))
          .map((entry) => ({ value: entry, label: entry })),
      )
      const unavailableColumnsMessage =
        unknownColumns.size > 0
          ? ` Unavailable config columns were removed for this source: ${[...unknownColumns].sort((a, b) => a.localeCompare(b)).join(', ')}.`
          : ''
      setAlert({
        tone: 'success',
        message:
          columns.length > 0
            ? `${sourceMode === 'teable' ? 'Teable' : 'Excel'} import successful. ${columns.length} columns available.${payload.message ? ` ${payload.message}` : ''}${unavailableColumnsMessage}`
            : `${sourceMode === 'teable' ? 'Teable' : 'Excel'} import successful.${payload.message ? ` ${payload.message}` : ''}${unavailableColumnsMessage}`,
      })
    } catch (error) {
      setAlert({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Database import failed.',
      })
    } finally {
      setImportInProgress(false)
    }
  }

  const updateLanguages = (next: string[]) => {
    const sanitized = [...new Set(next.map((entry) => entry.trim()).filter(Boolean))]
    patchActiveDataframe((df) => ({
      ...df,
      plotLanguages: sanitized.length > 0 ? sanitized : ['en'],
      language: sanitized.includes(df.language) ? df.language : (sanitized[0] ?? 'en'),
      legendTitle: sanitized.reduce<Record<string, string>>((acc, lang) => ({
        ...acc,
        [lang]: df.legendTitle[lang] ?? df.legendTitle[df.language] ?? df.legendTitle.en ?? '',
      }), {}),
      axes: df.axes.map((axis) => ({
        ...axis,
        labels: sanitized.reduce<Record<string, string>>((acc, lang) => ({
          ...acc,
          [lang]: axis.labels[lang] ?? axis.labels[df.language] ?? axis.labels.en ?? '',
        }), {}),
      })),
      frames: df.frames.map((frame) => ({
        ...frame,
        language: sanitized.includes(frame.language) ? frame.language : (sanitized[0] ?? df.language ?? 'en'),
        title: sanitized.reduce<Record<string, string>>((acc, lang) => ({
          ...acc,
          [lang]: frame.title[lang] ?? frame.title[frame.language] ?? frame.title[df.language] ?? frame.title.en ?? '',
        }), {}),
      })),
    }))
  }

  const addPlotLanguage = (language: string) => {
    const normalized = language.trim()
    if (!normalized) return
    updateLanguages([...activeDataframe.plotLanguages, normalized])
    setPlotLanguageDraft('')
  }

  const handlePlotLanguageKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === ',' || event.key === 'Enter') {
      event.preventDefault()
      addPlotLanguage(plotLanguageDraft)
    }
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const normalized = normalizePlotConfig(parseImportedConfig(await file.text(), true))
      const detectedLanguages = getConfigLanguages(normalized)
      const normalizedWithLanguages: PlotConfig = {
        ...normalized,
        dataframes: normalized.dataframes.map((df) => {
          const languages = detectedLanguages.length > 0 ? detectedLanguages : df.plotLanguages
          return {
            ...df,
            plotLanguages: languages,
            language: languages.includes(df.language) ? df.language : (languages[0] ?? 'en'),
          }
        }),
      }
      setPlotConfig(normalizedWithLanguages)
      setConfigBaseName(file.name.replace(/\.[^.]+$/, '') || 'ashby-config')
      setAvailableColumns(getConfigAxisColumns(normalizedWithLanguages))
      setAvailableWhitelistKeywords(getConfigWhitelistKeywords(normalizedWithLanguages).map((entry) => ({ value: entry, label: entry })))
      setAlert({ tone: 'success', message: `Imported ${file.name} successfully.` })
    } catch {
      setAlert({ tone: 'error', message: 'Invalid config file.' })
    } finally {
      event.target.value = ''
    }
  }

  const handleSpreadsheetSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      await importDatabase(file)
    } finally {
      event.target.value = ''
    }
  }

  const parseJsonField = <T,>(value: string, fallback: T): T => {
    try {
      return value.trim() ? JSON.parse(value) as T : fallback
    } catch {
      return fallback
    }
  }

  const openTabWithSelection = (dataframeIndex: number, frameIndex: number) => {
    const params = new URLSearchParams(window.location.search)
    params.set('dataframe', String(dataframeIndex))
    params.set('frame', String(frameIndex))
    window.open(`${window.location.pathname}?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  const applyTabRename = () => {
    if (!tabRename) return
    const trimmed = tabRename.value.trim()
    if (tabRename.type === 'dataframe') {
      patchDataframe(tabRename.index, (df) => ({ ...df, name: trimmed || undefined }))
      if (tabRename.index === activeDataframeIndex) {
        setActiveFrameIndex(0)
      }
    } else {
      patchActiveDataframe((df) => ({
        ...df,
        frames: df.frames.map((frame, index) => (index === tabRename.index ? { ...frame, name: trimmed || undefined } : frame)),
      }))
    }
    setTabRename(null)
  }

  const openJsonEditor = () => {
    const external = toExternalConfig(plotConfig)
    const nextDraft = JSON.stringify(external, null, 2)
    setJsonDraft(nextDraft)
    setShowJson(true)
  }

  const applyJsonEditor = () => {
    try {
      setPlotConfig(normalizePlotConfig(parseImportedConfig(jsonDraft, true)))
      setAlert({ tone: 'success', message: 'JSON applied.' })
      setShowJson(false)
    } catch {
      setAlert({ tone: 'error', message: 'Invalid JSON in popup editor.' })
    }
  }

  const jsonMarker = useMemo(() => {
    const stack: Array<{ char: string; index: number }> = []
    const unmatched = new Set<number>()
    let inString = false
    let escaped = false
    let stringStartIndex = -1
    for (let index = 0; index < jsonDraft.length; index += 1) {
      const char = jsonDraft[index]
      if (inString) {
        if (escaped) {
          escaped = false
          continue
        }
        if (char === '\\') {
          escaped = true
          continue
        }
        if (char === '"') {
          inString = false
          stringStartIndex = -1
        }
        continue
      }
      if (char === '"') {
        inString = true
        stringStartIndex = index
        continue
      }
      if (char === '{' || char === '[') {
        stack.push({ char, index })
      } else if (char === '}' || char === ']') {
        const last = stack[stack.length - 1]
        if (!last) {
          unmatched.add(index)
          continue
        }
        const validPair = (last.char === '{' && char === '}') || (last.char === '[' && char === ']')
        if (validPair) {
          stack.pop()
        } else {
          unmatched.add(last.index)
          unmatched.add(index)
          stack.pop()
        }
      }
    }
    stack.forEach((entry) => unmatched.add(entry.index))
    if (inString && stringStartIndex >= 0) {
      unmatched.add(stringStartIndex)
    }
    return unmatched
  }, [jsonDraft])

  const jsonHighlightedHtml = useMemo(() => {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    const pushToken = (buffer: string, mode: 'plain' | 'string' | 'number' | 'keyword') => {
      if (!buffer) return ''
      if (mode === 'string') return `<span class="text-shadow-emerald-600">${escapeHtml(buffer)}</span>`
      if (mode === 'number') return `<span class="text-sky-700">${escapeHtml(buffer)}</span>`
      if (mode === 'keyword') return `<span class="text-fuchsia-600">${escapeHtml(buffer)}</span>`
      return escapeHtml(buffer)
    }

    let output = ''
    let buffer = ''
    let mode: 'plain' | 'string' | 'number' | 'keyword' = 'plain'
    let escaped = false
    for (let index = 0; index < jsonDraft.length; index += 1) {
      const char = jsonDraft[index]

      if (jsonMarker.has(index) && ['{', '}', '[', ']', '"', "'"].includes(char)) {
        output += pushToken(buffer, mode)
        buffer = ''
        mode = 'plain'
        output += `<span class="rounded bg-red-500/20 text-red-300">${escapeHtml(char)}</span>`
        continue
      }

      if (mode === 'string') {
        buffer += char
        if (escaped) {
          escaped = false
          continue
        }
        if (char === '\\') {
          escaped = true
          continue
        }
        if (char === '"') {
          output += pushToken(buffer, mode)
          buffer = ''
          mode = 'plain'
        }
        continue
      }

      if (char === '"') {
        output += pushToken(buffer, mode)
        buffer = '"'
        mode = 'string'
        continue
      }

      if (/[[\]{}:,]/.test(char)) {
        output += pushToken(buffer, mode)
        buffer = ''
        mode = 'plain'
        output += `<span class="text-zinc-400">${escapeHtml(char)}</span>`
        continue
      }

      if (char === '\n' || char === ' ' || char === '\t') {
        output += pushToken(buffer, mode)
        buffer = ''
        mode = 'plain'
        output += char === '\n' ? '\n' : char === '\t' ? '  ' : ' '
        continue
      }

      if (mode === 'plain') {
        buffer = char
        mode = /[0-9-]/.test(char) ? 'number' : /[A-Za-z]/.test(char) ? 'keyword' : 'plain'
      } else {
        buffer += char
      }
    }
    output += pushToken(buffer, mode)
    return output
  }, [jsonDraft, jsonMarker])

  return (
    // + header 
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4 text-left dark:border-zinc-800">
        <div className="flex items-center gap-5 text-sm">
          <h1 className="m-0 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Ashby Plot Builder</h1>
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setShowMenu((current) => !current)}>Menu</Button>
          <span className="px-2 text-zinc-400">|</span>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>Import</Button>
          <Button type="button" variant="outline" onClick={() => exportConfig(plotConfig)}>Export</Button>
          <Button type="button" variant="outline" onClick={() => setShowResetConfirm(true)}>Reset</Button>
          <span className="px-2 text-zinc-400">|</span>
          <Button type="button" variant="outline" onClick={() => setActivePage('config')}>Config</Button>
          <Button type="button" variant="outline" onClick={openJsonEditor}>{t('json')}</Button>
          <span className="px-2 text-zinc-400">|</span>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPlotAction('preview-current')
              setPlotActionNonce((current) => current + 1)
              setActivePage('plot')
            }}
          >
            Preview one Plot
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPlotAction('create-all')
              setPlotActionNonce((current) => current + 1)
              setActivePage('plot')
            }}
          >
            Create all Plots
          </Button>
          {showMenu ? (
            <div className="absolute left-0 top-11 z-40 grid min-w-44 gap-1 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowAbout(true); setShowMenu(false) }}>About</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowSettings(true); setShowMenu(false) }}>Settings</Button>
            </div>
          ) : null}
        </div>
      </header>

      {activePage === 'config' ? (
        // + Tabbar 
        <main className="mx-auto grid min-h-0 w-full max-w-[1800px] flex-1 grid-cols-1 gap-4 p-5 text-left">
          <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{t('dataframe')}</span>
              {plotConfig.dataframes.map((df, index) => (
                <div
                  key={index}
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
                  key={index}
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
                    <option key={`move-frame-${index}`} value={index}>
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

          {alert ? (
            <Alert variant={alert.tone === 'success' ? 'success' : 'destructive'} className="flex items-center justify-between gap-3">
              <span>{alert.message}</span>
              <button type="button" className="rounded px-1 text-sm leading-none hover:bg-black/10 dark:hover:bg-white/10" onClick={() => setAlert(null)} aria-label="Close notification">✕</button>
            </Alert>
          ) : null}

          {/* + Dataframe */}
          <DataframeSection
            t={t}
            uiLanguage={uiLanguage}
            activeDataframe={activeDataframe}
            patchActiveDataframe={patchActiveDataframe}
            numberValue={numberValue}
            FONT_STYLE_OPTIONS={FONT_STYLE_OPTIONS}
            FONT_FAMILY_OPTIONS={FONT_FAMILY_OPTIONS}
            CUSTOM_SELECT_VALUE={CUSTOM_SELECT_VALUE}
            importInProgress={importInProgress}
            importDatabase={importDatabase}
            uploadInputRef={uploadInputRef}
            handleSpreadsheetSelection={handleSpreadsheetSelection}
            importedDatabaseStatus={importedDatabaseStatus}
            activeDataframeIndex={activeDataframeIndex}
            plotLanguageDraft={plotLanguageDraft}
            setPlotLanguageDraft={setPlotLanguageDraft}
            handlePlotLanguageKeyDown={handlePlotLanguageKeyDown}
            addPlotLanguage={addPlotLanguage}
            updateLanguages={updateLanguages}
            FieldComponent={Field}
          />

          {/* ~ Axes */}
          <AxesSection
            t={t}
            uiLanguage={uiLanguage}
            activeDataframe={activeDataframe}
            hoveredRemoveGroup={hoveredRemoveGroup}
            setHoveredRemoveGroup={setHoveredRemoveGroup}
            addAxis={addAxis}
            removeAxis={removeAxis}
            updateAxis={updateAxis}
            availableAxisColumns={availableAxisColumns}
            expandedAxisColumns={expandedAxisColumns}
            setExpandedAxisColumns={setExpandedAxisColumns}
            AXIS_MODES={AXIS_MODES}
            FieldComponent={Field}
            MultiSelectInputComponent={MultiSelectInput}
            RemoveIconButtonComponent={RemoveIconButton}
          />

          {/* ~ Layers */}
          <LayersSection
            t={t}
            uiLanguage={uiLanguage}
            activeFrame={activeFrame}
            hoveredRemoveGroup={hoveredRemoveGroup}
            setHoveredRemoveGroup={setHoveredRemoveGroup}
            patchActiveFrame={patchActiveFrame}
            addLayer={addLayer}
            layerNameOptions={layerNameOptions}
            availableKeywordsByColumn={availableKeywordsByColumn}
            availableWhitelistKeywords={availableWhitelistKeywords}
            expandedLayerKeywords={expandedLayerKeywords}
            setExpandedLayerKeywords={setExpandedLayerKeywords}
            numberValue={numberValue}
            FieldComponent={Field}
            MultiSelectInputComponent={MultiSelectInput}
            RemoveIconButtonComponent={RemoveIconButton}
          />

          {/* ~ colors */}
          <ColoredAreasSection
            t={t}
            uiLanguage={uiLanguage}
            activeFrame={activeFrame}
            hoveredRemoveGroup={hoveredRemoveGroup}
            setHoveredRemoveGroup={setHoveredRemoveGroup}
            patchActiveFrame={patchActiveFrame}
            parseJsonField={parseJsonField}
            numberValue={numberValue}
            materialColorOptions={materialColorOptions}
            FieldComponent={Field}
            RemoveIconButtonComponent={RemoveIconButton}
            ColorOrMaterialInputComponent={ColorOrMaterialInput}
          />

          {/* + Frame */}
          <FrameSection
            t={t}
            uiLanguage={uiLanguage}
            activeFrame={activeFrame}
            activeDataframe={activeDataframe}
            patchActiveFrame={patchActiveFrame}
            patchActiveDataframe={patchActiveDataframe}
            PLOT_ALGORITHMS={PLOT_ALGORITHMS}
            automaticDisplayAreaActive={automaticDisplayAreaActive}
            numberValue={numberValue}
            FieldComponent={Field}
          />

          {/* ~ Guidelines */}
          <GuidelinesSection
            t={t}
            uiLanguage={uiLanguage}
            activeFrame={activeFrame}
            hoveredRemoveGroup={hoveredRemoveGroup}
            setHoveredRemoveGroup={setHoveredRemoveGroup}
            patchActiveFrame={patchActiveFrame}
            updateGuideline={updateGuideline}
            addGuideline={addGuideline}
            materialColorOptions={materialColorOptions}
            numberValue={numberValue}
            FieldComponent={Field}
            RemoveIconButtonComponent={RemoveIconButton}
            ColorOrMaterialInputComponent={ColorOrMaterialInput}
          />

          {/* ~ Annotations */}
          <AnnotationsSection
            t={t}
            uiLanguage={uiLanguage}
            activeFrame={activeFrame}
            hoveredRemoveGroup={hoveredRemoveGroup}
            setHoveredRemoveGroup={setHoveredRemoveGroup}
            patchActiveFrame={patchActiveFrame}
            numberValue={numberValue}
            materialColorOptions={materialColorOptions}
            FieldComponent={Field}
            RemoveIconButtonComponent={RemoveIconButton}
            ColorOrMaterialInputComponent={ColorOrMaterialInput}
          />

          {/* ~ colors */}
          <MaterialColorsSection
            t={t}
            activeDataframe={activeDataframe}
            customMaterialNames={customMaterialNames}
            setCustomMaterialNames={setCustomMaterialNames}
            materialKeywordOptions={materialKeywordOptions}
            CUSTOM_SELECT_VALUE={CUSTOM_SELECT_VALUE}
            patchActiveDataframe={patchActiveDataframe}
            setShowGenerateColorsConfirm={setShowGenerateColorsConfirm}
          />

          <AdvancedJsonSection
            t={t}
            uiLanguage={uiLanguage}
            activeFrame={activeFrame}
            patchActiveFrame={patchActiveFrame}
            parseJsonField={parseJsonField}
            FieldComponent={Field}
          />
        </main>
      ) : (
        <PlotPage
          plotConfig={plotConfig}
          configBaseName={configBaseName}
          activeDataframeIndex={activeDataframeIndex}
          activeFrameIndex={activeFrameIndex}
          plotAction={plotAction}
          plotActionNonce={plotActionNonce}
        />
      )}

      {/* + popouts */}
      <AppPopouts
        showAbout={showAbout}
        showSettings={showSettings}
        showGenerateColorsConfirm={showGenerateColorsConfirm}
        showJson={showJson}
        showResetConfirm={showResetConfirm}
        jsonFullscreen={jsonFullscreen}
        jsonDraft={jsonDraft}
        jsonHighlightedHtml={jsonHighlightedHtml}
        settingsContent={(
          <Field language={uiLanguage} label={t('uiLanguage')} jsonPath="ui.language">
            <Select value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value as UILanguage)}>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </Select>
          </Field>
        )}
        onCloseAbout={() => setShowAbout(false)}
        onCloseSettings={() => setShowSettings(false)}
        onCloseGenerateColorsConfirm={() => setShowGenerateColorsConfirm(false)}
        onGenerateMaterialColors={generateMaterialColors}
        onToggleJsonFullscreen={() => setJsonFullscreen((current) => !current)}
        onCloseJson={() => setShowJson(false)}
        onJsonDraftChange={setJsonDraft}
        onApplyJsonEditor={applyJsonEditor}
        onJsonScroll={(top, left) => {
          if (jsonOverlayRef.current) {
            jsonOverlayRef.current.scrollTop = top
            jsonOverlayRef.current.scrollLeft = left
          }
        }}
        onCloseResetConfirm={() => setShowResetConfirm(false)}
        onConfirmReset={() => { setPlotConfig(createDefaultPlotConfig()); setShowResetConfirm(false) }}
        t={t}
        jsonOverlayRef={jsonOverlayRef}
        jsonTextareaRef={jsonTextareaRef}
      />


    </div>
  )
}

export default App
