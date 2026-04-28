import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { PlotPage } from './components/PlotPage'
import { Alert } from './components/ui/alert'
import { Button } from './components/ui/button'
import { normalizePlotConfig } from './config/configMappers'
import { AXIS_MODES, PLOT_ALGORITHMS, createDefaultPlotConfig, type AxisConfig, type DataframeConfig, type FrameConfig, type GuidelineConfig, type PlotConfig } from './config/defaultPlotConfig'
import { exportConfig, parseImportedConfig, toExternalConfig } from './utils/configIo'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'

type AppPage = 'config' | 'plot'
type AlertTone = 'success' | 'error'
interface AlertState { tone: AlertTone; message: string }
type SourceMode = 'teable' | 'file'
type UILanguage = 'en' | 'de'
type JsonRenderTarget = { dataframeIndex: number; frameIndex: number }
type PlotAction = 'preview-current' | 'create-all'

type MultiOption = { value: string; label: string }
type ImportDatabaseResponse = { columns?: string[]; import_file_name?: string; message?: string; success?: boolean }

const WHITELIST_OPTIONS: MultiOption[] = [
  { value: 'ABS', label: 'ABS' },
  { value: 'PA12', label: 'PA12' },
  { value: 'PEEK', label: 'PEEK' },
  { value: 'PETG', label: 'PETG' },
]

const DEFAULT_THEME = 'system'
type ThemeMode = 'light' | 'dark' | 'system'

const numberValue = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback)
const parseNumberList = (value: string): number[] =>
  value
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry))
const toCommaList = (values: number[] | undefined): string => (values ?? []).join(', ')
const parseColumnsFromImportResult = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map((entry) => entry.trim()))]
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

const hsvToHex = (hue: number, saturation: number, value: number): string => {
  const c = value * saturation
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = value - c
  let rgb: [number, number, number] = [0, 0, 0]

  if (hue < 60) rgb = [c, x, 0]
  else if (hue < 120) rgb = [x, c, 0]
  else if (hue < 180) rgb = [0, c, x]
  else if (hue < 240) rgb = [0, x, c]
  else if (hue < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]

  return `#${rgb
    .map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0'))
    .join('')}`
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

const getConfigWhitelistKeywords = (config: PlotConfig): string[] =>
  [...new Set(config.dataframes.flatMap((df) => df.frames.flatMap((frame) => frame.layers.flatMap((layer) => layer.whitelist ?? []))))].sort((a, b) => a.localeCompare(b))

const getConfigAxisColumns = (config: PlotConfig): string[] =>
  [...new Set(config.dataframes.flatMap((df) => df.axes.flatMap((axis) => axis.columns)))].sort((a, b) => a.localeCompare(b))
const getSourceMode = (dataframe: DataframeConfig): SourceMode =>
  dataframe._extensions.sourceMode === 'teable' || dataframe._extensions.sourceMode === 'file'
    ? dataframe._extensions.sourceMode
      : dataframe.teableUrl || dataframe.apiKey
      ? 'teable'
      : 'file'

const getUniqueMaterialKey = (materialColors: Record<string, string>, seed = 'new_material'): string => {
  if (!materialColors[seed]) return seed
  let index = 1
  while (materialColors[`${seed}_${index}`]) {
    index += 1
  }
  return `${seed}_${index}`
}

const UI_LABELS: Record<UILanguage, Record<string, string>> = {
  en: {
    json: 'JSON',
    showPlot: 'Preview Plot',
    showConfig: 'Show Config',
    dataframe: 'Dataframe',
    frame: 'Frame',
    globalDataframe: 'Global + Dataframe',
    createAllDataframes: 'Create all dataframes',
    dataframeName: 'Dataframe name',
    dataframeLanguage: 'Dataframe language',
    imageRatio: 'Image ratio',
    resolution: 'Resolution',
    dataframeDarkMode: 'Dataframe dark mode',
    createAllFrames: 'Create all frames',
    fontStyle: 'Font style',
    fontFamily: 'Font family',
    fontSize: 'Font size',
    dataSourceLanguage: 'Data source + language set',
    sourceMode: 'Source mode',
    importSheet: 'Import sheet',
    apiKey: 'API key',
    teableUrl: 'Teable URL',
    uploadXlsx: 'Upload .xlsx',
    upload: 'Upload',
    uploadAndImport: 'Upload & import',
    plotLanguages: 'Plot languages',
    add: 'Add',
    axisColumnsPlaceholder: 'Select axis columns.',
    axisColumnsPlaceholderEmpty: 'Load a datasource or import a config to see selectable axis columns.',
    whitelistPlaceholder: 'Select keywords.',
  },
  de: {
    json: 'JSON',
    showPlot: 'Plot-Vorschau',
    showConfig: 'Konfiguration anzeigen',
    dataframe: 'Datenrahmen',
    frame: 'Frame',
    globalDataframe: 'Global + Datenrahmen',
    createAllDataframes: 'Alle Datenrahmen erstellen',
    dataframeName: 'Name des Datenrahmens',
    dataframeLanguage: 'Sprache des Datenrahmens',
    imageRatio: 'Bildverhältnis',
    resolution: 'Auflösung',
    dataframeDarkMode: 'Dunkelmodus Datenrahmen',
    createAllFrames: 'Alle Frames erstellen',
    fontStyle: 'Schriftstil',
    fontFamily: 'Schriftfamilie',
    fontSize: 'Schriftgröße',
    dataSourceLanguage: 'Datenquelle + Sprachsatz',
    sourceMode: 'Quellmodus',
    importSheet: 'Importblatt',
    apiKey: 'API-Schlüssel',
    teableUrl: 'Teable-URL',
    uploadXlsx: '.xlsx hochladen',
    upload: 'Hochladen',
    uploadAndImport: 'Hochladen & importieren',
    plotLanguages: 'Plot-Sprachen',
    add: 'Hinzufügen',
    axisColumnsPlaceholder: 'Achsenspalten auswählen.',
    axisColumnsPlaceholderEmpty: 'Lade eine Datenquelle oder importiere eine Konfiguration, um auswählbare Achsenspalten zu sehen.',
    whitelistPlaceholder: 'Schlüsselwörter auswählen.',
  },
}

const FIELD_DESCRIPTIONS: Record<UILanguage, Array<{ match: RegExp; description: string }>> = {
  en: [
    { match: /^dataframes\[i\]\.language$/, description: 'Primary language used for labels and legends in this dataframe.' },
    { match: /^dataframes\[i\]\.dark_mode$/, description: 'Switches font and style defaults for dark backgrounds.' },
    { match: /^frames\[j\]\.algorithm$/, description: 'Hull approximation algorithm used when generating areas.' },
    { match: /^guidelines\[\d+\]\.m$/, description: 'Slope of the guideline; 1 means a 45° rise in linear space.' },
    { match: /^annotations\[\d+\]\.text\.rel_pos\[0\]$/, description: 'Horizontal text offset from annotation anchor (plot-relative).' },
    { match: /^annotations\[\d+\]\.text\.rel_pos\[1\]$/, description: 'Vertical text offset from annotation anchor (plot-relative).' },
    { match: /^colored_areas\[\d+\]\.axes$/, description: 'Axis-bound ranges. When set, these override polygon x/y lists.' },
    { match: /^colored_areas\[\d+\]\.x$/, description: 'Polygon x coordinates for manual area corners.' },
    { match: /^colored_areas\[\d+\]\.y$/, description: 'Polygon y coordinates for manual area corners.' },
  ],
  de: [
    { match: /^dataframes\[i\]\.language$/, description: 'Primäre Sprache für Achsen- und Legendentexte dieses Datenrahmens.' },
    { match: /^dataframes\[i\]\.dark_mode$/, description: 'Schaltet Schrift- und Stilvorgaben für dunkle Hintergründe um.' },
    { match: /^frames\[j\]\.algorithm$/, description: 'Algorithmus zur Berechnung der Hüllkurven/Flächen.' },
    { match: /^guidelines\[\d+\]\.m$/, description: 'Steigung der Leitlinie; 1 entspricht 45° im linearen Raum.' },
    { match: /^annotations\[\d+\]\.text\.rel_pos\[0\]$/, description: 'Horizontaler Textversatz zum Annotations-Anker (plotrelativ).' },
    { match: /^annotations\[\d+\]\.text\.rel_pos\[1\]$/, description: 'Vertikaler Textversatz zum Annotations-Anker (plotrelativ).' },
    { match: /^colored_areas\[\d+\]\.axes$/, description: 'Achsgebundene Bereiche. Wenn gesetzt, werden x/y-Polygone ignoriert.' },
    { match: /^colored_areas\[\d+\]\.x$/, description: 'X-Koordinaten des manuellen Polygonbereichs.' },
    { match: /^colored_areas\[\d+\]\.y$/, description: 'Y-Koordinaten des manuellen Polygonbereichs.' },
  ],
}

function Field({ label, jsonPath, language, children }: { label: string; jsonPath: string; language: UILanguage; children: ReactNode }) {
  const description = FIELD_DESCRIPTIONS[language].find((entry) => entry.match.test(jsonPath))?.description
  const tooltip = description ? `${jsonPath}\n${description}` : jsonPath
  return (
    <div className="grid gap-2">
      <label title={tooltip} className="font-medium text-zinc-900 dark:text-zinc-100">{label}</label>
      {children}
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

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <div className="flex items-center gap-2">
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
      <div className={`${expanded ? 'max-h-64' : 'max-h-28'} overflow-auto rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900`}>
        {options.length > 0 ? (
          options.map((option) => (
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
          <p className="m-0 py-1 text-sm text-zinc-500">No options available.</p>
        )}
      </div>
    </div>
  )
}

function RemoveIconButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" className="absolute right-2 top-2 h-7 px-2" onClick={onClick} aria-label="Remove">
      ✕
    </Button>
  )
}

function App() {
  const [plotConfig, setPlotConfig] = useState<PlotConfig>(() => createDefaultPlotConfig())
  const [activePage, setActivePage] = useState<AppPage>('config')
  const [activeDataframeIndex, setActiveDataframeIndex] = useState(0)
  const [activeFrameIndex, setActiveFrameIndex] = useState(0)
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
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME
    const stored = window.localStorage.getItem('ui-theme')
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : DEFAULT_THEME
  })
  const [jsonFullscreen, setJsonFullscreen] = useState(false)
  const [expandedAxisColumns, setExpandedAxisColumns] = useState<Record<number, boolean>>({})
  const [expandedLayerKeywords, setExpandedLayerKeywords] = useState<Record<number, boolean>>({})
  const [expandedFrameTitleInputs, setExpandedFrameTitleInputs] = useState(false)
  const [importedDatabaseStatus, setImportedDatabaseStatus] = useState<Record<number, { imported: boolean; source: SourceMode }>>({})
  const [plotActionNonce, setPlotActionNonce] = useState(0)
  const [plotAction, setPlotAction] = useState<PlotAction>('preview-current')

  const activeDataframe = plotConfig.dataframes[activeDataframeIndex] ?? plotConfig.dataframes[0]
  const activeFrame = activeDataframe.frames[activeFrameIndex] ?? activeDataframe.frames[0]
  const sourceMode = getSourceMode(activeDataframe)
  const darkPreferred = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false
  const resolvedDarkMode = themeMode === 'dark' || (themeMode === 'system' && darkPreferred)
  const t = (key: string) => UI_LABELS[uiLanguage][key] ?? key
  const activePlotLanguage = activeDataframe.language
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
    const stored = window.localStorage.getItem('ashby-plot-config')
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
    window.localStorage.setItem('ashby-plot-config', JSON.stringify(toExternalConfig(plotConfig)))
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
    const html = document.documentElement
    const darkPreferred = window.matchMedia('(prefers-color-scheme: dark)').matches
    const useDark = themeMode === 'dark' || (themeMode === 'system' && darkPreferred)
    html.classList.toggle('dark', useDark)
    html.style.colorScheme = useDark ? 'dark' : 'light'
    window.localStorage.setItem('ui-theme', themeMode)
  }, [themeMode])

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
      source.name = getNextTabName(current.dataframes.map((df) => df.name), 'Dataframe')
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
      clone.name = getNextTabName(current.dataframes.map((df) => df.name), original.name?.trim() || 'Dataframe')
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
      clone.name = getNextTabName(df.frames.map((frame) => frame.name), original.name?.trim() || 'Frame')
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
    patchActiveDataframe((df) => {
      const keys = Object.keys(df.materialColors)
      if (keys.length === 0) return df
      const nextColors = keys.reduce<Record<string, string>>((acc, key, index) => {
        const hue = (index / keys.length) * 360
        const brightness = index % 2 === 0 ? 0.78 : 0.62
        acc[key] = hsvToHex(hue, 0.75, brightness)
        return acc
      }, {})
      return { ...df, materialColors: nextColors }
    })
    setShowGenerateColorsConfirm(false)
  }

  const toggleDummyValue = () => {
    patchActiveDataframe((df) => ({
      ...df,
      _extensions: {
        ...df._extensions,
        dummyValue: !(df._extensions.dummyValue === true),
      },
    }))
  }

  const addAxis = () => {
    patchActiveDataframe((df) => ({
      ...df,
      axes: [
        ...df.axes,
        {
          name: `axis_${df.axes.length + 1}`,
          columns: [],
          mode: 'default',
          labels: df.plotLanguages.reduce<Record<string, string>>((acc, lang) => ({ ...acc, [lang]: '' }), {}),
        },
      ],
    }))
  }

  const addLayer = () => {
    patchActiveFrame((frame) => ({
      ...frame,
      layers: [...frame.layers, { name: `Layer ${frame.layers.length + 1}`, whitelistFlag: false, whitelist: [], alpha: 0.4, linewidth: 1.5 }],
    }))
  }

  const addGuideline = () => {
    patchActiveFrame((frame) => ({
      ...frame,
      guidelines: [
        ...frame.guidelines,
        {
          m: 1,
          lineProps: { linestyle: '--', color: 'aqua', linewidth: 4 },
          fontsize: 18,
          fontColor: '',
          label: '',
          labelAbove: true,
          labelPadding: 6,
        },
      ],
    }))
  }

  const updateAxis = (axisIndex: number, patch: (axis: AxisConfig) => AxisConfig) => {
    patchActiveDataframe((df) => ({ ...df, axes: df.axes.map((axis, index) => (index === axisIndex ? patch(axis) : axis)) }))
  }

  const updateGuideline = (guidelineIndex: number, patch: (guideline: GuidelineConfig) => GuidelineConfig) => {
    patchActiveFrame((frame) => ({
      ...frame,
      guidelines: frame.guidelines.map((guideline, index) => (index === guidelineIndex ? patch(guideline) : guideline)),
    }))
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
        importFileName: payload.import_file_name ?? df.importFileName,
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
      if (mode === 'string') return `<span class="text-emerald-400">${escapeHtml(buffer)}</span>`
      if (mode === 'number') return `<span class="text-sky-400">${escapeHtml(buffer)}</span>`
      if (mode === 'keyword') return `<span class="text-purple-400">${escapeHtml(buffer)}</span>`
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
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4 text-left dark:border-zinc-800">
        <div className="flex items-center gap-5 text-sm">
          <h1 className="m-0 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Ashby Plot Builder</h1>
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setShowMenu((current) => !current)}>Menu</Button>
          <span className="px-2 text-zinc-400">|</span>
          <input ref={fileInputRef} type="file" accept=".json,.jsonc,application/json" className="hidden" onChange={handleImportFile} />
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
                      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                        activeDataframeIndex === index
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
                        className="rounded px-1 text-xs leading-none hover:bg-zinc-200 dark:hover:bg-zinc-700"
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
                        className="rounded px-1 text-xs leading-none hover:bg-zinc-200 dark:hover:bg-zinc-700"
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
                      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                        activeFrameIndex === index
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
                        className="rounded px-1 text-xs leading-none hover:bg-zinc-200 dark:hover:bg-zinc-700"
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
                        className="rounded px-1 text-xs leading-none hover:bg-zinc-200 dark:hover:bg-zinc-700"
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

          <section className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold">{t('globalDataframe')}</h3>
            <Field language={uiLanguage} label={t('dataframeLanguage')} jsonPath="dataframes[i].language">
              <Select value={activeDataframe.language} onChange={(e) => patchActiveDataframe((c) => ({ ...c, language: e.target.value }))}>
                {activeDataframe.plotLanguages.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
              </Select>
            </Field>
            <Field language={uiLanguage} label={t('imageRatio')} jsonPath="dataframes[i].image_ratio"><Input type="number" step="0.01" value={activeDataframe.imageRatio} onChange={(e) => patchActiveDataframe((c) => ({ ...c, imageRatio: numberValue(e.target.valueAsNumber, c.imageRatio) }))} /></Field>
            <Field language={uiLanguage} label={t('resolution')} jsonPath="dataframes[i].resolution">
              <Input
                value={String(activeDataframe.resolution)}
                onChange={(e) =>
                  patchActiveDataframe((c) => {
                    const raw = e.target.value.trim().toLowerCase()
                    if (raw === 'svg') {
                      return { ...c, resolution: 'svg' }
                    }
                    const numeric = Number(raw === '' ? 0 : raw)
                    if (!Number.isFinite(numeric)) {
                      return { ...c, resolution: 0 }
                    }
                    return { ...c, resolution: Math.min(999, Math.max(30, Math.round(numeric))) }
                  })
                }
              />
            </Field>
            <Field language={uiLanguage} label={t('dataframeDarkMode')} jsonPath="dataframes[i].dark_mode"><Select value={activeDataframe.darkMode ? 'true' : 'false'} onChange={(e) => patchActiveDataframe((c) => ({ ...c, darkMode: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
            <Field language={uiLanguage} label="Dummy value toggle" jsonPath="dataframes[i]._extensions.dummyValue">
              <Button type="button" variant="outline" onClick={toggleDummyValue}>
                {activeDataframe._extensions.dummyValue === true ? 'Disable dummy_value' : 'Enable dummy_value'}
              </Button>
            </Field>
            <Field language={uiLanguage} label={t('fontStyle')} jsonPath="font.font_style"><Input value={activeDataframe.font.fontStyle} onChange={(e) => patchActiveDataframe((c) => ({ ...c, font: { ...c.font, fontStyle: e.target.value } }))} /></Field>
            <Field language={uiLanguage} label={t('fontFamily')} jsonPath="font.font"><Input value={activeDataframe.font.font} onChange={(e) => patchActiveDataframe((c) => ({ ...c, font: { ...c.font, font: e.target.value } }))} /></Field>
            <Field language={uiLanguage} label={t('fontSize')} jsonPath="font.font_size"><Input type="number" value={activeDataframe.font.fontSize} onChange={(e) => patchActiveDataframe((c) => ({ ...c, font: { ...c.font, fontSize: numberValue(e.target.valueAsNumber, c.font.fontSize) } }))} /></Field>
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold">{t('dataSourceLanguage')}</h3>
            <Field language={uiLanguage} label={t('sourceMode')} jsonPath="_extensions.source_mode">
              <Select
                value={sourceMode}
                onChange={(e) =>
                  patchActiveDataframe((c) => ({
                    ...c,
                    _extensions: { ...c._extensions, sourceMode: e.target.value as SourceMode },
                  }))
                }
              >
                <option value="file">Upload .xlsx</option>
                <option value="teable">Teable URL + API key</option>
              </Select>
            </Field>
            <Field language={uiLanguage} label={t('importSheet')} jsonPath="import_sheet"><Input type="number" value={activeDataframe.importSheet} onChange={(e) => patchActiveDataframe((c) => ({ ...c, importSheet: numberValue(e.target.valueAsNumber, c.importSheet) }))} /></Field>
            {sourceMode === 'teable' ? (
              <>
            <Field language={uiLanguage} label={t('apiKey')} jsonPath="API_Key"><Input value={activeDataframe.apiKey ?? ''} onChange={(e) => patchActiveDataframe((c) => ({ ...c, apiKey: e.target.value || undefined }))} /></Field>
                <Field language={uiLanguage} label={t('teableUrl')} jsonPath="teable_url"><Input value={activeDataframe.teableUrl ?? ''} onChange={(e) => patchActiveDataframe((c) => ({ ...c, teableUrl: e.target.value || undefined }))} /></Field>
              </>
            ) : (
            <Field language={uiLanguage} label={t('uploadXlsx')} jsonPath="import_file_name">
                <div className="flex gap-2">
                  <Input value={activeDataframe.importFileName ?? ''} readOnly placeholder="No file selected" />
                    <Button type="button" variant="outline" onClick={() => uploadInputRef.current?.click()} disabled={importInProgress}>
                      {importInProgress ? 'Importing…' : t('uploadAndImport')}
                    </Button>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={handleSpreadsheetSelection}
                  />
                </div>
              </Field>
            )}
            <Field language={uiLanguage} label={t('plotLanguages')} jsonPath="dataframes[i].plot_languages">
              <div className="flex items-center gap-2">
                <Input
                  value={plotLanguageDraft}
                  placeholder="Add language and press comma"
                  onChange={(e) => setPlotLanguageDraft(e.target.value)}
                  onKeyDown={handlePlotLanguageKeyDown}
                />
                <Button type="button" variant="outline" onClick={() => addPlotLanguage(plotLanguageDraft)}>{t('add')}</Button>
              </div>
            </Field>
            {sourceMode === 'teable' ? (
              <div className="sm:col-span-2 flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    void importDatabase()
                  }}
                  disabled={importInProgress}
                >
                  {importInProgress ? 'Importing…' : 'Import database'}
                </Button>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <p className="m-0 text-xs text-zinc-600 dark:text-zinc-300">
                Database import status:{' '}
                <strong className={importedDatabaseStatus[activeDataframeIndex]?.imported ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                  {importedDatabaseStatus[activeDataframeIndex]?.imported ? `Imported (${importedDatabaseStatus[activeDataframeIndex]?.source})` : 'Not imported'}
                </strong>
              </p>
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
              {activeDataframe.plotLanguages.map((lang) => (
                <button key={lang} type="button" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${activeDataframe.language === lang ? 'border-violet-500 bg-violet-100' : 'border-zinc-300'}`} onClick={() => patchActiveDataframe((c) => ({ ...c, language: lang }))}>
                  <span>{lang}</span>
                  <span role="button" tabIndex={0} className="font-semibold" onClick={(event) => { event.stopPropagation(); updateLanguages(activeDataframe.plotLanguages.filter((entry) => entry !== lang)) }}>
                    ×
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold">Frame</h3>
            <Field language={uiLanguage} label="Export file name" jsonPath="frames[j].export_file_name"><Input value={activeFrame.exportFileName ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, exportFileName: e.target.value || undefined }))} /></Field>
            <Field language={uiLanguage} label="Algorithm" jsonPath="frames[j].algorithm"><Select value={activeFrame.algorithm} onChange={(e) => patchActiveFrame((c) => ({ ...c, algorithm: e.target.value as FrameConfig['algorithm'] }))}>{PLOT_ALGORITHMS.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field>
            <Field language={uiLanguage} label="Legend enabled" jsonPath="legend_flag"><Select value={activeFrame.legendFlag ? 'true' : 'false'} onChange={(e) => patchActiveFrame((c) => ({ ...c, legendFlag: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
            <Field language={uiLanguage} label="Legend above" jsonPath="legend_above"><Select value={activeFrame.legendAbove ? 'true' : 'false'} onChange={(e) => patchActiveFrame((c) => ({ ...c, legendAbove: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
            <Field language={uiLanguage} label="Frame language" jsonPath="language"><Select value={activeFrame.language} onChange={(e) => patchActiveFrame((c) => ({ ...c, language: e.target.value }))}>{activeDataframe.plotLanguages.map((lang) => <option key={`frame-${lang}`} value={lang}>{lang}</option>)}</Select></Field>
            <Field language={uiLanguage} label="Frame dark mode" jsonPath="dark_mode"><Select value={activeFrame.darkMode ? 'true' : 'false'} onChange={(e) => patchActiveFrame((c) => ({ ...c, darkMode: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
            <Field language={uiLanguage} label="X quantity" jsonPath="x_quantity"><Select value={activeFrame.xQuantity} onChange={(e) => patchActiveFrame((c) => ({ ...c, xQuantity: e.target.value }))}>{activeDataframe.axes.map((axis) => <option key={axis.name} value={axis.name}>{axis.name}</option>)}</Select></Field>
            <Field language={uiLanguage} label="Y quantity" jsonPath="y_quantity"><Select value={activeFrame.yQuantity} onChange={(e) => patchActiveFrame((c) => ({ ...c, yQuantity: e.target.value }))}>{activeDataframe.axes.map((axis) => <option key={axis.name} value={axis.name}>{axis.name}</option>)}</Select></Field>
            <Field language={uiLanguage} label="Relative X quantity" jsonPath="x_rel_quantity"><Input value={activeFrame.xRelQuantity ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, xRelQuantity: e.target.value || undefined }))} /></Field>
            <Field language={uiLanguage} label="Relative Y quantity" jsonPath="y_rel_quantity"><Input value={activeFrame.yRelQuantity ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, yRelQuantity: e.target.value || undefined }))} /></Field>
            <Field language={uiLanguage} label="Log X" jsonPath="log_x_flag"><Select value={activeFrame.logXFlag ? 'true' : 'false'} onChange={(e) => patchActiveFrame((c) => ({ ...c, logXFlag: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
            <Field language={uiLanguage} label="Log Y" jsonPath="log_y_flag"><Select value={activeFrame.logYFlag ? 'true' : 'false'} onChange={(e) => patchActiveFrame((c) => ({ ...c, logYFlag: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
            <Field language={uiLanguage} label="X limits (json)" jsonPath="x_lim"><Input value={JSON.stringify(activeFrame.xLim ?? null)} onChange={(e) => patchActiveFrame((c) => ({ ...c, xLim: parseJsonField<[number, number] | undefined>(e.target.value, c.xLim) }))} /></Field>
            <Field language={uiLanguage} label="Y limits (json)" jsonPath="y_lim"><Input value={JSON.stringify(activeFrame.yLim ?? null)} onChange={(e) => patchActiveFrame((c) => ({ ...c, yLim: parseJsonField<[number, number] | undefined>(e.target.value, c.yLim) }))} /></Field>
            <Field language={uiLanguage} label="Automatic display area margin" jsonPath="automatic_Display_Area_margin"><Input type="number" step="0.01" value={activeFrame.automaticDisplayAreaMargin} onChange={(e) => patchActiveFrame((c) => ({ ...c, automaticDisplayAreaMargin: numberValue(e.target.valueAsNumber, c.automaticDisplayAreaMargin) }))} /></Field>
            <Field language={uiLanguage} key={activePlotLanguage} label={`Title (${activePlotLanguage})`} jsonPath={`title.${activePlotLanguage}`}>
              <Input
                value={activeFrame.title[activePlotLanguage] ?? ''}
                onFocus={() => setExpandedFrameTitleInputs(true)}
                onChange={(e) => patchActiveFrame((c) => ({ ...c, title: { ...c.title, [activePlotLanguage]: e.target.value } }))}
              />
            </Field>
            {expandedFrameTitleInputs
              ? activeDataframe.plotLanguages
                  .filter((lang) => lang !== activePlotLanguage)
                  .map((lang) => (
                    <Field key={`title-${lang}`} language={uiLanguage} label={`Title (${lang})`} jsonPath={`title.${lang}`}>
                      <Input value={activeFrame.title[lang] ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, title: { ...c.title, [lang]: e.target.value } }))} />
                    </Field>
                  ))
              : null}
            <Field language={uiLanguage} key={`legend-${activePlotLanguage}`} label={`Legend title (${activePlotLanguage})`} jsonPath={`legend_title.${activePlotLanguage}`}><Input value={activeDataframe.legendTitle[activePlotLanguage] ?? ''} onChange={(e) => patchActiveDataframe((c) => ({ ...c, legendTitle: { ...c.legendTitle, [activePlotLanguage]: e.target.value } }))} /></Field>
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-transparent">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{uiLanguage === 'en' ? 'Axes' : 'Achsen'}</h3>
              <Button variant="outline" size="sm" onClick={addAxis}>+ Axes</Button>
            </div>
            {activeDataframe.axes.map((axis, axisIndex) => (
              <div key={`${axis.name}-${axisIndex}`} className="relative grid gap-3 rounded-lg border border-zinc-300 bg-zinc-50 p-3 pr-12 dark:border-zinc-700 dark:bg-zinc-900 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <RemoveIconButton onClick={() => removeAxis(axisIndex)} />
                <div className="grid gap-2">
                  <Field language={uiLanguage} label={`Axis ${axisIndex + 1} Name`} jsonPath={`axes[${axisIndex}].name`}><Input value={axis.name} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, name: e.target.value }))} /></Field>
                  <Field language={uiLanguage} label={`Axis ${axisIndex + 1} Mode`} jsonPath={`axes[${axisIndex}].mode`}><Select value={axis.mode} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, mode: e.target.value as AxisConfig['mode'] }))}>{AXIS_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</Select></Field>
                  <Field language={uiLanguage} key={`${axis.name}-${activePlotLanguage}`} label={`Axis ${axisIndex + 1} Label (${activePlotLanguage})`} jsonPath={`axes[${axisIndex}].labels.${activePlotLanguage}`}><Input value={axis.labels[activePlotLanguage] ?? ''} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, labels: { ...a.labels, [activePlotLanguage]: e.target.value } }))} /></Field>
                </div>
                <MultiSelectInput
                  title={`Axis ${axisIndex + 1} Columns`}
                  value={axis.columns}
                  options={availableAxisColumns}
                  expanded={expandedAxisColumns[axisIndex] === true}
                  onToggleExpanded={() => setExpandedAxisColumns((current) => ({ ...current, [axisIndex]: !current[axisIndex] }))}
                  hideModeToggle
                  onChange={(next) => updateAxis(axisIndex, (a) => ({ ...a, columns: next }))}
                />
              </div>
            ))}
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-transparent">
            <div className="flex items-center gap-2"><h3 className="text-sm font-semibold">{uiLanguage === 'en' ? 'Layers' : 'Layer'}</h3><Button variant="outline" size="sm" onClick={addLayer}>+ Layer</Button></div>
            {activeFrame.layers.map((layer, layerIndex) => (
              <div key={layerIndex} className="relative grid gap-3 rounded-lg border border-zinc-300 p-3 pr-12 dark:border-zinc-700 sm:grid-cols-2">
                <RemoveIconButton onClick={() => patchActiveFrame((f) => ({ ...f, layers: f.layers.filter((_, i) => i !== layerIndex) }))} />
                <div className="grid gap-3">
                  <Field language={uiLanguage} label={`Layer ${layerIndex + 1} Name`} jsonPath={`layers[${layerIndex}].name`}>
                    <Select value={layer.name ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, name: e.target.value } : x) }))}>
                      <option value="">Select column</option>
                      {layerNameOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  </Field>
                  <Field language={uiLanguage} label="Line width" jsonPath={`layers[${layerIndex}].linewidth`}><Input type="number" min={0} step={0.1} value={layer.linewidth ?? 1.5} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, linewidth: Math.max(0, numberValue(e.target.valueAsNumber, x.linewidth ?? 1.5)) } : x) }))} /></Field>
                  <Field language={uiLanguage} label="Alpha" jsonPath={`layers[${layerIndex}].alpha`}><Input type="number" step={0.05} min={0} max={1} value={layer.alpha ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, alpha: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : x) }))} /></Field>
                </div>
                <MultiSelectInput
                  title="Whitelist keywords"
                  value={layer.whitelist ?? []}
                  options={availableWhitelistKeywords}
                  expanded={expandedLayerKeywords[layerIndex] === true}
                  onToggleExpanded={() => setExpandedLayerKeywords((current) => ({ ...current, [layerIndex]: !current[layerIndex] }))}
                  modeValue={layer.whitelistFlag ?? false}
                  onModeChange={(next) =>
                    patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => (i === layerIndex ? { ...x, whitelistFlag: next } : x)) }))
                  }
                  onChange={(next) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, whitelist: next } : x) }))}
                />
                <Field language={uiLanguage} label="Alpha points" jsonPath={`layers[${layerIndex}].alpha_points`}><Input type="number" step={0.05} min={0} max={1} value={layer.alphaPoints ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, alphaPoints: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : x) }))} /></Field>
                <Field language={uiLanguage} label="Alpha areas" jsonPath={`layers[${layerIndex}].alpha_areas`}><Input type="number" step={0.05} min={0} max={1} value={layer.alphaAreas ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, alphaAreas: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : x) }))} /></Field>
              </div>
            ))}
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-transparent">
            <div className="flex items-center gap-2"><h3 className="text-sm font-semibold">{uiLanguage === 'en' ? 'Guidelines' : 'Leitlinien'}</h3><Button variant="outline" size="sm" onClick={addGuideline}>+ Guideline</Button></div>
            {activeFrame.guidelines.map((guideline, index) => (
              <div key={index} className="relative grid gap-3 rounded-lg border border-zinc-300 p-3 pr-12 dark:border-zinc-700 sm:grid-cols-2">
                <RemoveIconButton onClick={() => patchActiveFrame((f) => ({ ...f, guidelines: f.guidelines.filter((_, i) => i !== index) }))} />
                <Field language={uiLanguage} label="x" jsonPath={`guidelines[${index}].x`}><Input type="number" value={guideline.x ?? ''} onChange={(e) => updateGuideline(index, (g) => ({ ...g, x: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} /></Field>
                <Field language={uiLanguage} label="y" jsonPath={`guidelines[${index}].y`}><Input type="number" value={guideline.y ?? ''} onChange={(e) => updateGuideline(index, (g) => ({ ...g, y: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} /></Field>
                <Field language={uiLanguage} label="m" jsonPath={`guidelines[${index}].m`}><Input type="number" value={guideline.m} onChange={(e) => updateGuideline(index, (g) => ({ ...g, m: numberValue(e.target.valueAsNumber, g.m) }))} /></Field>
                <Field language={uiLanguage} label="line_props.linestyle" jsonPath={`guidelines[${index}].line_props.linestyle`}><Input value={guideline.lineProps.linestyle} onChange={(e) => updateGuideline(index, (g) => ({ ...g, lineProps: { ...g.lineProps, linestyle: e.target.value } }))} /></Field>
                <Field language={uiLanguage} label="line_props.color" jsonPath={`guidelines[${index}].line_props.color`}><Input value={guideline.lineProps.color} onChange={(e) => updateGuideline(index, (g) => ({ ...g, lineProps: { ...g.lineProps, color: e.target.value } }))} /></Field>
                <Field language={uiLanguage} label="line_props.linewidth" jsonPath={`guidelines[${index}].line_props.linewidth`}><Input type="number" value={guideline.lineProps.linewidth} onChange={(e) => updateGuideline(index, (g) => ({ ...g, lineProps: { ...g.lineProps, linewidth: numberValue(e.target.valueAsNumber, g.lineProps.linewidth) } }))} /></Field>
                <Field language={uiLanguage} label="fontsize" jsonPath={`guidelines[${index}].fontsize`}><Input type="number" value={guideline.fontsize} onChange={(e) => updateGuideline(index, (g) => ({ ...g, fontsize: numberValue(e.target.valueAsNumber, g.fontsize) }))} /></Field>
                <Field language={uiLanguage} label="font_color" jsonPath={`guidelines[${index}].font_color`}><Input value={guideline.fontColor} onChange={(e) => updateGuideline(index, (g) => ({ ...g, fontColor: e.target.value }))} /></Field>
                <Field language={uiLanguage} label="label" jsonPath={`guidelines[${index}].label`}><Input value={guideline.label} onChange={(e) => updateGuideline(index, (g) => ({ ...g, label: e.target.value }))} /></Field>
                <Field language={uiLanguage} label="label_above" jsonPath={`guidelines[${index}].label_above`}><Select value={guideline.labelAbove ? 'true' : 'false'} onChange={(e) => updateGuideline(index, (g) => ({ ...g, labelAbove: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
                <Field language={uiLanguage} label="label_padding" jsonPath={`guidelines[${index}].label_padding`}><Input type="number" value={guideline.labelPadding} onChange={(e) => updateGuideline(index, (g) => ({ ...g, labelPadding: numberValue(e.target.valueAsNumber, g.labelPadding) }))} /></Field>
              </div>
            ))}
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center gap-2">
              <h3 className="m-0 text-sm font-semibold">Annotations</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => patchActiveFrame((f) => ({ ...f, annotations: [...f.annotations, { text: { name: '', relPos: [0, 0], color: '#111827' }, axes: { x: 0, y: 0 }, marker: { color: 'default', markerSymbol: 'o', sizeFactor: 1, linewidths: 0, edgecolors: 'black' } }] }))}>+ Annotation</Button>
            </div>
            {activeFrame.annotations.map((annotation, annotationIndex) => (
              <div key={annotationIndex} className="relative grid gap-2 rounded-lg border border-zinc-300 p-3 pr-12 dark:border-zinc-700 sm:col-span-2 sm:grid-cols-2">
                <RemoveIconButton onClick={() => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.filter((_, i) => i !== annotationIndex) }))} />
                <Field language={uiLanguage} label="Default marker size" jsonPath={`annotations[${annotationIndex}].marker_size`}><Input type="number" value={annotation.markerSize ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, markerSize: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Default font size" jsonPath={`annotations[${annotationIndex}].font_size`}><Input type="number" value={annotation.fontSize ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, fontSize: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Text label" jsonPath={`annotations[${annotationIndex}].text.name`}><Input value={annotation.text?.name ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, text: { name: e.target.value, relPos: entry.text?.relPos ?? [0, 0], color: entry.text?.color ?? '#111827', fontSize: entry.text?.fontSize } } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Text color" jsonPath={`annotations[${annotationIndex}].text.color`}><Input value={annotation.text?.color ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, text: { name: entry.text?.name ?? '', relPos: entry.text?.relPos ?? [0, 0], color: e.target.value, fontSize: entry.text?.fontSize } } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Text offset X" jsonPath={`annotations[${annotationIndex}].text.rel_pos[0]`}><Input type="number" value={annotation.text?.relPos?.[0] ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, text: { name: entry.text?.name ?? '', relPos: [numberValue(e.target.valueAsNumber, entry.text?.relPos?.[0] ?? 0), entry.text?.relPos?.[1] ?? 0], color: entry.text?.color ?? '#111827', fontSize: entry.text?.fontSize } } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Text offset Y" jsonPath={`annotations[${annotationIndex}].text.rel_pos[1]`}><Input type="number" value={annotation.text?.relPos?.[1] ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, text: { name: entry.text?.name ?? '', relPos: [entry.text?.relPos?.[0] ?? 0, numberValue(e.target.valueAsNumber, entry.text?.relPos?.[1] ?? 0)], color: entry.text?.color ?? '#111827', fontSize: entry.text?.fontSize } } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Anchor axis X value" jsonPath={`annotations[${annotationIndex}].axes.x`}><Input type="number" value={annotation.axes?.x ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, axes: { ...(entry.axes ?? {}), x: numberValue(e.target.valueAsNumber, 0) } } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Anchor axis Y value" jsonPath={`annotations[${annotationIndex}].axes.y`}><Input type="number" value={annotation.axes?.y ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, axes: { ...(entry.axes ?? {}), y: numberValue(e.target.valueAsNumber, 0) } } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Marker symbol" jsonPath={`annotations[${annotationIndex}].marker.marker_symbol`}><Input value={annotation.marker?.markerSymbol ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, marker: { color: entry.marker?.color ?? 'default', markerSymbol: e.target.value, sizeFactor: entry.marker?.sizeFactor ?? 1, linewidths: entry.marker?.linewidths ?? 0, edgecolors: entry.marker?.edgecolors ?? 'black' } } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Marker color" jsonPath={`annotations[${annotationIndex}].marker.color`}><Input value={annotation.marker?.color ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, marker: { color: e.target.value, markerSymbol: entry.marker?.markerSymbol ?? 'o', sizeFactor: entry.marker?.sizeFactor ?? 1, linewidths: entry.marker?.linewidths ?? 0, edgecolors: entry.marker?.edgecolors ?? 'black' } } : entry) }))} /></Field>
              </div>
            ))}
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{uiLanguage === 'en' ? 'Material colors' : 'Materialfarben'}</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowGenerateColorsConfirm(true)}>
                Generate colors
              </Button>
            </div>
            {Object.entries(activeDataframe.materialColors).map(([material, color]) => (
              <div key={material} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={material}
                    onChange={(e) =>
                      patchActiveDataframe((df) => {
                        const nextKey = e.target.value.trim()
                        if (!nextKey || nextKey === material || df.materialColors[nextKey]) return df
                        const nextColors = Object.entries(df.materialColors).reduce<Record<string, string>>((acc, [key, value]) => {
                          acc[key === material ? nextKey : key] = value
                          return acc
                        }, {})
                        return { ...df, materialColors: nextColors }
                      })
                    }
                  />
                  <button
                    type="button"
                    className="rounded px-2 text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    onClick={() =>
                      patchActiveDataframe((df) => {
                        const rest = Object.fromEntries(Object.entries(df.materialColors).filter(([key]) => key !== material))
                        return { ...df, materialColors: rest }
                      })
                    }
                    aria-label={`Remove ${material}`}
                  >
                    ✕
                  </button>
                </div>
                <Input type="color" value={color} className="h-10 w-16 p-1" onChange={(e) => patchActiveDataframe((df) => ({ ...df, materialColors: { ...df.materialColors, [material]: e.target.value } }))} />
                <Input value={color} onChange={(e) => patchActiveDataframe((df) => ({ ...df, materialColors: { ...df.materialColors, [material]: e.target.value } }))} />
              </div>
            ))}
            <Field language={uiLanguage} label="Add color key" jsonPath="material_colors">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  patchActiveDataframe((df) => {
                    const key = getUniqueMaterialKey(df.materialColors)
                    return { ...df, materialColors: { ...df.materialColors, [key]: '#000000' } }
                  })
                }
              >
                Add material color
              </Button>
            </Field>
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold">{uiLanguage === 'en' ? 'Advanced JSON fields' : 'Erweiterte JSON-Felder'}</h3>
            <Field language={uiLanguage} label="Filter" jsonPath="filter"><textarea className="min-h-24 rounded-md border border-zinc-300 bg-white p-2 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" value={JSON.stringify(activeFrame.filter ?? {}, null, 2)} onChange={(e) => patchActiveFrame((f) => ({ ...f, filter: parseJsonField<Record<string, unknown>>(e.target.value, f.filter ?? {}) }))} /></Field>
            <div className="sm:col-span-2 grid gap-3">
              <div className="flex items-center gap-2">
                <h4 className="m-0 text-sm font-semibold">Colored areas</h4>
                <Button type="button" size="sm" variant="outline" onClick={() => patchActiveFrame((f) => ({ ...f, coloredAreas: [...f.coloredAreas, { x: [0, 1], y: [0, 1], color: '#ef4444', alpha: 0.2 }] }))}>+ Area</Button>
              </div>
              {activeFrame.coloredAreas.map((area, areaIndex) => (
                <div key={areaIndex} className="relative grid gap-2 rounded-lg border border-zinc-300 p-3 pr-12 dark:border-zinc-700 sm:grid-cols-2">
                  <RemoveIconButton onClick={() => patchActiveFrame((f) => ({ ...f, coloredAreas: f.coloredAreas.filter((_, i) => i !== areaIndex) }))} />
                  <Field language={uiLanguage} label="Axis ranges JSON" jsonPath={`colored_areas[${areaIndex}].axes`}><Input value={JSON.stringify(area.axes ?? {})} onChange={(e) => patchActiveFrame((f) => ({ ...f, coloredAreas: f.coloredAreas.map((entry, i) => i === areaIndex ? { ...entry, axes: parseJsonField<Record<string, [number, number][]>>(e.target.value, entry.axes ?? {}) } : entry) }))} /></Field>
                  <Field language={uiLanguage} label="Polygon X points (comma separated)" jsonPath={`colored_areas[${areaIndex}].x`}><Input value={toCommaList(area.x)} onChange={(e) => patchActiveFrame((f) => ({ ...f, coloredAreas: f.coloredAreas.map((entry, i) => i === areaIndex ? { ...entry, x: parseNumberList(e.target.value) } : entry) }))} /></Field>
                  <Field language={uiLanguage} label="Polygon Y points (comma separated)" jsonPath={`colored_areas[${areaIndex}].y`}><Input value={toCommaList(area.y)} onChange={(e) => patchActiveFrame((f) => ({ ...f, coloredAreas: f.coloredAreas.map((entry, i) => i === areaIndex ? { ...entry, y: parseNumberList(e.target.value) } : entry) }))} /></Field>
                  <Field language={uiLanguage} label="color" jsonPath={`colored_areas[${areaIndex}].color`}><Input value={area.color} onChange={(e) => patchActiveFrame((f) => ({ ...f, coloredAreas: f.coloredAreas.map((entry, i) => i === areaIndex ? { ...entry, color: e.target.value } : entry) }))} /></Field>
                  <Field language={uiLanguage} label="alpha" jsonPath={`colored_areas[${areaIndex}].alpha`}><Input type="number" min={0} max={1} step={0.05} value={area.alpha} onChange={(e) => patchActiveFrame((f) => ({ ...f, coloredAreas: f.coloredAreas.map((entry, i) => i === areaIndex ? { ...entry, alpha: numberValue(e.target.valueAsNumber, entry.alpha) } : entry) }))} /></Field>
                </div>
              ))}
            </div>
            <Field language={uiLanguage} label="Highlighted hulls" jsonPath="highlighted_hulls"><textarea className="min-h-24 rounded-md border border-zinc-300 bg-white p-2 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" value={JSON.stringify(activeFrame.highlightedHulls, null, 2)} onChange={(e) => patchActiveFrame((f) => ({ ...f, highlightedHulls: parseJsonField(e.target.value, f.highlightedHulls) }))} /></Field>
          </section>
        </main>
      ) : (
        <PlotPage
          plotConfig={plotConfig}
          activeDataframeIndex={activeDataframeIndex}
          activeFrameIndex={activeFrameIndex}
          plotAction={plotAction}
          plotActionNonce={plotActionNonce}
        />
      )}

      {showAbout ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="mt-0 text-lg">About</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Ashby Plot Builder helps create and edit plotting configs with live backend SVG rendering.
            </p>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowAbout(false)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}

      {showSettings ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="mt-0 text-lg">Settings</h3>
            <div className="grid gap-2">
              <Field language={uiLanguage} label="UI language" jsonPath="ui.language">
                <Select value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value as UILanguage)}>
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </Select>
              </Field>
              <Field language={uiLanguage} label="Theme" jsonPath="ui.theme">
                <Select value={themeMode} onChange={(event) => setThemeMode(event.target.value as ThemeMode)}>
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </Select>
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowSettings(false)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}

      {showGenerateColorsConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="mt-0 text-lg">Generate new material colors?</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              This overwrites all current material colors and spaces hues evenly across all keys.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowGenerateColorsConfirm(false)}>Cancel</Button>
              <Button onClick={generateMaterialColors}>Yes, generate</Button>
            </div>
          </div>
        </div>
      ) : null}

      {showJson ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className={`${jsonFullscreen ? 'h-[96vh] w-[96vw] max-w-none' : 'max-h-[85vh] w-full max-w-4xl'} overflow-hidden rounded-lg border border-zinc-700 bg-white dark:bg-zinc-950`}>
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
              <h3 className="text-sm font-semibold">JSON Editor</h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setJsonFullscreen((current) => !current)}>
                  {jsonFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowJson(false)}>Close</Button>
              </div>
            </div>
            <div className={`${jsonFullscreen ? 'h-[calc(96vh-7.5rem)]' : 'h-[70vh]'} relative`}>
              <pre
                ref={jsonOverlayRef}
                aria-hidden
                className={`pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-[18px] ${resolvedDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-100 text-zinc-900'}`}
                dangerouslySetInnerHTML={{ __html: jsonHighlightedHtml }}
              />
              <textarea
                ref={jsonTextareaRef}
                className={`absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent p-3 font-mono text-xs leading-[18px] text-transparent ${resolvedDarkMode ? 'caret-white' : 'caret-zinc-900'}`}
                value={jsonDraft}
                onScroll={(event) => {
                  if (jsonOverlayRef.current) {
                    jsonOverlayRef.current.scrollTop = event.currentTarget.scrollTop
                    jsonOverlayRef.current.scrollLeft = event.currentTarget.scrollLeft
                  }
                }}
                onChange={(e) => setJsonDraft(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              <Button size="sm" onClick={applyJsonEditor}>Apply JSON</Button>
            </div>
          </div>
        </div>
      ) : null}

      {showResetConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="mt-0 text-lg">Reset configuration?</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">This will replace your current changes with the default config.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
              <Button onClick={() => { setPlotConfig(createDefaultPlotConfig()); setShowResetConfirm(false) }}>Confirm reset</Button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  )
}

export default App
