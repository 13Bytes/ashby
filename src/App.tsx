import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent } from 'react'
import { PlotPage } from './components/layout/PlotPage'
import { Alert, TimedAlert } from './components/ui/alert'
import { Button } from './components/ui/button'
import { getConfigVersion, normalizePlotConfig } from './config/configMappers'
import { CONFIG_VERSION, type PlotConfig } from './config/defaultPlotConfig'
import { exportConfig, findExternalFrameOffset, parseImportedConfig, toExternalConfig } from './utils/configIo'
import { Select } from './components/ui/select'
import { createTranslator, I18nContext, readStoredUILanguage, UI_LANGUAGE_STORAGE_KEY, type UILanguage } from './uiTranslations'
import { AppPopouts, SettingsRow } from './components/layout/AppPopouts'
import { AttributionKeySetting } from './components/layout/AttributionKeySetting'
import { checkAttributionKey, readAttributionKey, setAttributionKey } from './utils/attributionKey'
import { addPlotLanguageToList, normalizePlotLanguages } from './utils/plotLanguages'
import { AppHeader } from './components/layout/AppHeader'
import { OverviewPage } from './components/overview/OverviewPage'
import { PrivacyDialog } from './components/overview/PrivacyDialog'
import { ConfigSections } from './components/settings/ConfigSections'
import { ConfigTabs } from './components/layout/ConfigTabs'
import { Toggle, Switch } from './components/common/AppControls'
import { byDataframeIndex, dataframeLabel, getAxisBasesFromColumns, getConfigLanguages, getConfigWhitelistKeywords, getSourceMode, getUiKey, parseColumnsFromImportResult, type SourceMode } from './utils/appState'
import { getJsonSyntaxMarkers } from './utils/jsonHighlight'
import { usePlotConfigActions } from './hooks/usePlotConfigActions'
import { applyUITheme, readStoredUITheme, subscribeToSystemTheme, UI_THEME_STORAGE_KEY, type UIThemePreference } from './utils/uiTheme'
import { cacheDatasourceFile, clearCachedDatasourceFiles, getCachedDatasourceFile, toMemoryFile } from './utils/datasourceStorage'
import { createConfigSync, getUrlWorkspaceId, getWorkspaceId, WORKSPACE_URL_PARAM, type ConfigSync } from './utils/tabSync'
import { BackendError, fetchBackend, isForeignServerResponse, toErrorDetails } from './utils/backendErrors'
import { addLogEntry } from './utils/debugLog'
import { SETTINGS_SECTIONS, isHiddenInMode, isSettingsSectionId, type SettingsMode, type SettingsSectionId } from './config/settingsSections'
import { getDataframeMissing, getFrameMissing } from './utils/settingsStatus'
import { SettingsContext } from './utils/settingsContext'
import { ResizeDivider } from './components/layout/ResizeDivider'
import { SettingsNav, type SectionStatus } from './components/layout/SettingsNav'
import { cn } from './lib/utils'
import { describeFormatWarning, parseFormatWarnings, type ExcelFormatWarning } from './utils/excelFormat'

type AlertTone = 'success' | 'warning' | 'error'; interface AlertState { tone: AlertTone; message: string }
/** How long a notice at the top stays, unless the pointer is on it. */
const NOTICE_SECONDS: Record<AlertTone, number> = { success: 6, warning: 15, error: 15 }
type PlotAction = 'preview-current' | 'create-all'

type ImportDatabaseResponse = { columns?: string[]; keywords_by_column?: Record<string, string[]>; import_file_name?: string; message?: string; success?: boolean; sheet_names?: string[]; format_warnings?: unknown }
/** What the last datasource import of a dataframe returned; kept per dataframe (by UI key). */
type ImportedSource = { columns: string[]; keywordsByColumn: Record<string, string[]>; sheets: string[]; formatWarnings: ExcelFormatWarning[] }
const EMPTY_KEYWORDS: Record<string, string[]> = {}
const EMPTY_FORMAT_WARNINGS: ExcelFormatWarning[] = []

const CONFIG_STORAGE_KEY = 'ashby-plot-config'
const SETTINGS_MODE_STORAGE_KEY = 'ashby-settings-mode'
const PREVIEW_WIDTH_STORAGE_KEY = 'ashby-preview-width'
const NAV_WIDTH_STORAGE_KEY = 'ashby-nav-width'
const AUTO_REFRESH_STORAGE_KEY = 'ashby-auto-refresh'
const SCROLL_SECTIONS_STORAGE_KEY = 'ashby-scroll-sections'
/** URL flag of tabs opened from a plot (middle-click): they start in the editor instead of the overview. */
const VIEW_URL_PARAM = 'view'
const DEFAULT_PREVIEW_WIDTH = 460
const MIN_PREVIEW_WIDTH = 280
const DEFAULT_NAV_WIDTH = 240
const MIN_NAV_WIDTH = 180
const MAX_NAV_WIDTH = 480
/** Width kept for the editor when the settings list or the preview is dragged wider (+ the 1px and 9px dividers). */
const MIN_EDITOR_WIDTH = 440 + 10

/** Identifies what an import of a dataframe read, to skip importing the same source again. */
const sourceSignature = (sourceMode: SourceMode, fileName: string | undefined, sheet: number) => `${sourceMode}:${fileName ?? ''}:${sheet}`

const readStored = <T,>(key: string, parse: (value: string | null) => T): T => {
  try {
    return parse(window.localStorage.getItem(key))
  } catch {
    return parse(null)
  }
}
const writeStored = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // not persisted, still applied for this session
  }
}
/** Datasource imports (Teable tables can take a while) give up after this long. */
const IMPORT_TIMEOUT_MS = 120_000
const JSON_EDITOR_LINE_HEIGHT = 18

/** Restores the config of this browser tab (sessionStorage survives reloads and is copied into tabs opened from here). */
function readStoredPlotConfig(): PlotConfig {
  try {
    const stored = window.sessionStorage.getItem(CONFIG_STORAGE_KEY)
    if (stored) return normalizePlotConfig(parseImportedConfig(stored))
  } catch {
    // ignore unavailable storage or an invalid cached config
  }
  return normalizePlotConfig()
}

/** True when this tab starts without its own config (a new tab, or a duplicate that got no sessionStorage). */
function startsWithoutStoredConfig(): boolean {
  try {
    return !window.sessionStorage.getItem(CONFIG_STORAGE_KEY)
  } catch {
    return true
  }
}

function App() {
  // Read before the first save, which stores the config of this tab.
  const [startedEmpty] = useState(startsWithoutStoredConfig)
  const [plotConfig, setPlotConfig] = useState<PlotConfig>(readStoredPlotConfig)
  const [workspaceId] = useState(() => getWorkspaceId())
  // The URL as the tab was opened with; effects rewrite it with the current selection.
  const [initialSearch] = useState(() => window.location.search)
  // Opening or reloading the page shows the overview first.
  const [showOverview, setShowOverview] = useState(() => new URLSearchParams(initialSearch).get(VIEW_URL_PARAM) !== 'editor')
  const [configBaseName, setConfigBaseName] = useState('ashby-config')
  const [activeDataframeIndex, setActiveDataframeIndex] = useState(0)
  const [activeFrameIndex, setActiveFrameIndex] = useState(0)
  const [showJson, setShowJson] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [jsonDraft, setJsonDraft] = useState('')
  const [alert, setAlert] = useState<AlertState | null>(null)
  /** Version warning of the imported config; its own banner, so the automatic data import's message does not replace it. */
  const [configWarning, setConfigWarning] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const jsonTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const jsonOverlayRef = useRef<HTMLPreElement | null>(null)
  const jsonJumpOffsetRef = useRef(-1)
  /** Per dataframe UI key: the source (mode, file, sheet) of its last import, so it is not imported again. */
  const importedSignaturesRef = useRef(new Map<string, string>())
  const [plotLanguageDraft, setPlotLanguageDraft] = useState('')
  const [uiLanguage, setUiLanguage] = useState<UILanguage>(readStoredUILanguage)
  const [uiTheme, setUiTheme] = useState<UIThemePreference>(() => readStoredUITheme())
  const [importedSources, setImportedSources] = useState<Record<string, ImportedSource>>({})
  const [importInProgress, setImportInProgress] = useState(false)
  const [tabRename, setTabRename] = useState<{ type: 'dataframe' | 'frame'; index: number; value: string } | null>(null)
  const [showAbout, setShowAbout] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const closePrivacy = useCallback(() => setShowPrivacy(false), [])
  const [showSettings, setShowSettings] = useState(false)
  const [showGenerateColorsConfirm, setShowGenerateColorsConfirm] = useState(false)
  const [jsonFullscreen, setJsonFullscreen] = useState(false)
  const [expandedAxisColumns, setExpandedAxisColumns] = useState<Record<number, boolean>>({})
  const [expandedLayerKeywords, setExpandedLayerKeywords] = useState<Record<number, boolean>>({})
  // Datasource state is kept per dataframe UI key, so it stays with its dataframe when dataframes
  // are reordered, moved or removed; the index-keyed views below are derived from it.
  const [importedStatusByKey, setImportedStatusByKey] = useState<Record<string, { imported: boolean; source: SourceMode }>>({})
  const [plotActionNonce, setPlotActionNonce] = useState(0)
  const [plotAction, setPlotAction] = useState<PlotAction>('preview-current')
  const [customMaterialNames, setCustomMaterialNames] = useState<Record<string, string>>({})
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null)
  /** Another program answers at the backend address instead of the Ashby backend. */
  const [backendForeign, setBackendForeign] = useState(false)
  const [availableDatasets, setAvailableDatasets] = useState<string[] | null>(null)
  const [datasourceFilesByKey, setDatasourceFilesByKey] = useState<Record<string, File>>({})
  const [datasourcePrompt, setDatasourcePrompt] = useState<{ dataframeIndex: number; dataframeKey: string; filename: string } | null>(null)
  const [dismissedDatasourcePrompts, setDismissedDatasourcePrompts] = useState<Record<string, boolean>>({})
  const [settingsMode, setSettingsMode] = useState<SettingsMode>(() => readStored(SETTINGS_MODE_STORAGE_KEY, (value) => (value === 'all' ? 'all' : 'simple')))
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('data')
  const [shownDefaults, setShownDefaults] = useState<ReadonlySet<SettingsSectionId>>(() => new Set())
  const [previewWidth, setPreviewWidth] = useState(() => readStored(PREVIEW_WIDTH_STORAGE_KEY, (value) => Number(value) || DEFAULT_PREVIEW_WIDTH))
  const [navWidth, setNavWidth] = useState(() => readStored(NAV_WIDTH_STORAGE_KEY, (value) => Number(value) || DEFAULT_NAV_WIDTH))
  const [autoRefresh, setAutoRefresh] = useState(() => readStored(AUTO_REFRESH_STORAGE_KEY, (value) => value !== 'false'))
  /** All settings sections in one scrollable column instead of one section at a time. */
  const [scrollSections, setScrollSections] = useState(() => readStored(SCROLL_SECTIONS_STORAGE_KEY, (value) => value === 'true'))
  const editorRef = useRef<HTMLElement | null>(null)
  const datasetsLoadRef = useRef<'idle' | 'loading' | 'loaded' | 'failed'>('idle')
  const pinnedSectionRef = useRef<SettingsSectionId | null>(null)
  const workRef = useRef<HTMLDivElement | null>(null)
  const activeDataframe = plotConfig.dataframes[activeDataframeIndex] ?? plotConfig.dataframes[0]
  const activeFrame = activeDataframe.frames[activeFrameIndex] ?? activeDataframe.frames[0]
  const i18n = useMemo(() => ({ language: uiLanguage, t: createTranslator(uiLanguage) }), [uiLanguage])
  const { t } = i18n
  const configSyncRef = useRef<ConfigSync | null>(null)
  const lastSyncedConfigRef = useRef<string | null>(null)
  /** Plot selection from the URL of a duplicated tab, applied once the config of the other tabs arrives. */
  const pendingSelectionRef = useRef<{ dataframe: number; frame: number } | null>(null)
  const activeDataframeKey = getUiKey(activeDataframe, 'dataframe')
  const dataframeKeys = useMemo(() => plotConfig.dataframes.map((dataframe) => getUiKey(dataframe, 'dataframe')), [plotConfig.dataframes])
  const datasourceFilesByDataframe = useMemo(() => byDataframeIndex(dataframeKeys, datasourceFilesByKey), [dataframeKeys, datasourceFilesByKey])
  const importedDatabaseStatus = useMemo(() => byDataframeIndex(dataframeKeys, importedStatusByKey), [dataframeKeys, importedStatusByKey])
  const activeImportedSource = importedSources[activeDataframeKey]
  const availableColumns = useMemo(() => activeImportedSource?.columns ?? [], [activeImportedSource])
  const availableKeywordsByColumn = activeImportedSource?.keywordsByColumn ?? EMPTY_KEYWORDS
  const availableWhitelistKeywords = useMemo(
    () => getConfigWhitelistKeywords(plotConfig).map((entry) => ({ value: entry, label: entry })),
    [plotConfig],
  )
  // Before this dataframe's source is imported, offer the columns the config already uses, so
  // selected entries stay visible and can be deselected.
  const availableAxisColumns = useMemo(
    () => (activeImportedSource
      ? getAxisBasesFromColumns(availableColumns)
      : [...new Set(activeDataframe.axes.flatMap((axis) => axis.columns))].sort((a, b) => a.localeCompare(b))
    ).map((column) => ({ value: column, label: column })),
    [activeDataframe.axes, activeImportedSource, availableColumns],
  )
  const layerNameOptions = useMemo(() => {
    if (!activeImportedSource) {
      return [...new Set(activeDataframe.frames.flatMap((frame) => frame.layers.map((layer) => layer.name?.trim() ?? '')))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .map((column) => ({ value: column, label: column }))
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
  }, [activeDataframe.frames, activeImportedSource, availableColumns])
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
  // Keywords a layer's whitelist/blacklist selection actually includes, across every frame of this
  // dataframe — used to populate a material-color entry for each of them.
  const includedLayerKeywords = useMemo(() => {
    const included = new Set<string>()
    for (const frame of activeDataframe.frames) {
      for (const layer of frame.layers) {
        const column = layer.name?.trim()
        if (!column) continue
        const sourceKeywords = (availableKeywordsByColumn[column] ?? []).length > 0
          ? availableKeywordsByColumn[column]
          : availableWhitelistKeywords.map((option) => option.value)
        const selected = new Set(layer.whitelist ?? [])
        for (const keyword of sourceKeywords) {
          const isIncluded = layer.whitelistFlag ? selected.has(keyword) : !selected.has(keyword)
          if (isIncluded) included.add(keyword)
        }
      }
    }
    return [...included].sort((a, b) => a.localeCompare(b))
  }, [activeDataframe.frames, availableKeywordsByColumn, availableWhitelistKeywords])
  const missingDatasourceDataframes = useMemo(
    () =>
      availableDatasets === null
        ? []
        : plotConfig.dataframes
            .map((dataframe, dataframeIndex) => ({ dataframe, dataframeIndex }))
            .filter(({ dataframe, dataframeIndex }) => {
              const sourceMode = getSourceMode(dataframe, availableDatasets ?? [])
              return (
                sourceMode === 'file' &&
                Boolean(dataframe.importFileName) &&
                datasourceFilesByDataframe[dataframeIndex]?.name !== dataframe.importFileName
              )
            }),
    [availableDatasets, datasourceFilesByDataframe, plotConfig.dataframes],
  )
  const displayedImportedDatabaseStatus = useMemo(() => {
    const status = { ...importedDatabaseStatus }

    plotConfig.dataframes.forEach((dataframe, dataframeIndex) => {
      const sourceMode = getSourceMode(dataframe, availableDatasets ?? [])
      // For dataset mode the importedDatabaseStatus entry from the actual
      // import call is authoritative — don't override it.
      if (sourceMode === 'dataset') return

      if (dataframe.excelImport !== true) {
        return
      }

      if (!dataframe.importFileName) {
        delete status[dataframeIndex]
        return
      }

      status[dataframeIndex] = {
        imported: datasourceFilesByDataframe[dataframeIndex]?.name === dataframe.importFileName,
        source: 'file',
      }
    })

    return status
  }, [availableDatasets, datasourceFilesByDataframe, importedDatabaseStatus, plotConfig.dataframes])
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
    // The URL the tab was opened with: in development effects run twice and the URL is rewritten in between.
    const params = new URLSearchParams(initialSearch)
    const df = Number(params.get('dataframe'))
    const frame = Number(params.get('frame'))
    if (Number.isInteger(df) && df >= 0) {
      setActiveDataframeIndex(df)
    }
    if (Number.isInteger(frame) && frame >= 0) {
      setActiveFrameIndex(frame)
    }
  }, [initialSearch])
  // Live sync with tabs of the same workspace (see utils/tabSync.ts).
  useEffect(() => {
    const sync = createConfigSync((serialized) => {
      try {
        const next = normalizePlotConfig(parseImportedConfig(serialized))
        // Remember what we received so the save effect below does not echo it back.
        lastSyncedConfigRef.current = JSON.stringify(toExternalConfig(next))
        setPlotConfig(next)
        // The first config of a duplicated tab: select the plot its URL names.
        const selection = pendingSelectionRef.current
        if (selection) {
          pendingSelectionRef.current = null
          const dataframeIndex = Math.min(selection.dataframe, next.dataframes.length - 1)
          setActiveDataframeIndex(dataframeIndex)
          setActiveFrameIndex(Math.min(selection.frame, next.dataframes[dataframeIndex].frames.length - 1))
        }
      } catch {
        // ignore malformed messages
      }
    }, () => lastSyncedConfigRef.current, workspaceId)
    configSyncRef.current = sync
    // A duplicated tab without sessionStorage knows its workspace only from the URL: fetch the config.
    if (startedEmpty && getUrlWorkspaceId(initialSearch) === workspaceId) {
      const params = new URLSearchParams(initialSearch)
      pendingSelectionRef.current = { dataframe: Math.max(0, Number(params.get('dataframe')) || 0), frame: Math.max(0, Number(params.get('frame')) || 0) }
      sync.requestConfig()
    }
    return () => {
      sync.close()
      configSyncRef.current = null
    }
  }, [initialSearch, startedEmpty, workspaceId])
  useEffect(() => {
    const serialized = JSON.stringify(toExternalConfig(plotConfig))
    try {
      window.sessionStorage.setItem(CONFIG_STORAGE_KEY, serialized)
    } catch {
      // storage full or unavailable: the config still lives in memory
    }
    // Publish local changes only; the initial config and received configs are not re-sent.
    if (lastSyncedConfigRef.current !== null && serialized !== lastSyncedConfigRef.current) {
      configSyncRef.current?.publish(serialized)
    }
    lastSyncedConfigRef.current = serialized
  }, [plotConfig])
  useEffect(() => {
    try {
      window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, uiLanguage)
    } catch {
      // not persisted, still applied for this session
    }
    document.documentElement.lang = uiLanguage
  }, [uiLanguage])
  // Keep the selection valid when dataframes/frames disappear (reset, import, JSON edit, URL params).
  useEffect(() => {
    const lastDataframeIndex = plotConfig.dataframes.length - 1
    if (activeDataframeIndex > lastDataframeIndex) {
      setActiveDataframeIndex(lastDataframeIndex)
      return
    }
    const lastFrameIndex = (plotConfig.dataframes[activeDataframeIndex]?.frames.length ?? 1) - 1
    if (activeFrameIndex > lastFrameIndex) {
      setActiveFrameIndex(lastFrameIndex)
    }
  }, [activeDataframeIndex, activeFrameIndex, plotConfig.dataframes])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('dataframe', String(activeDataframeIndex))
    params.set('frame', String(activeFrameIndex))
    params.set(WORKSPACE_URL_PARAM, workspaceId)
    // Read once at the start; a reload of this tab shows the overview again.
    params.delete(VIEW_URL_PARAM)
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [activeDataframeIndex, activeFrameIndex, workspaceId])
  // A key kept from an earlier visit may no longer be the server's: forget it, so the editor shows
  // what the server will draw.
  useEffect(() => {
    const key = readAttributionKey()
    if (!key) return
    checkAttributionKey(key).then((valid) => { if (!valid) setAttributionKey(null) }).catch(() => {})
  }, [])
  useEffect(() => {
    let active = true
    const checkBackendAvailability = async () => {
      try {
        // A backend that does not answer within 10 s counts as unavailable.
        const response = await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
        if (!active) return
        setBackendAvailable(response.ok)
        setBackendForeign(isForeignServerResponse(response))
      } catch {
        if (active) {
          setBackendAvailable(false)
          setBackendForeign(false)
        }
      }
    }
    void checkBackendAvailability()
    const interval = window.setInterval(checkBackendAvailability, 15000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])
  // The dataset catalog; loaded again once the backend becomes available if the first try failed.
  // One request at a time: a request in flight is not cancelled when the backend status changes.
  useEffect(() => {
    if (backendAvailable === false || datasetsLoadRef.current === 'loading' || datasetsLoadRef.current === 'loaded') return
    datasetsLoadRef.current = 'loading'
    const loadDatasets = async () => {
      try {
        const response = await fetch('/api/import-database/datasets', { cache: 'no-store' })
        const payload = await response.json().catch(() => ({})) as { datasets?: unknown }
        datasetsLoadRef.current = response.ok ? 'loaded' : 'failed'
        setAvailableDatasets(Array.isArray(payload.datasets) ? payload.datasets.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : [])
      } catch {
        datasetsLoadRef.current = 'failed'
        setAvailableDatasets((current) => current ?? [])
      }
    }
    void loadDatasets()
  }, [backendAvailable])
  useEffect(() => {
    let cancelled = false

    const restoreCachedDatasources = async () => {
      for (const { dataframe, dataframeIndex } of missingDatasourceDataframes) {
        const filename = dataframe.importFileName?.trim()
        if (!filename) continue
        const dataframeKey = getUiKey(dataframe, 'dataframe')

        try {
          const cachedFile = await getCachedDatasourceFile(filename)
          if (cancelled) return

          if (cachedFile) {
            setDatasourceFilesByKey((current) => current[dataframeKey]?.name === cachedFile.name ? current : { ...current, [dataframeKey]: cachedFile })
            setImportedStatusByKey((current) => ({
              ...current,
              [dataframeKey]: { imported: true, source: 'file' },
            }))
            continue
          }
        } catch {
          // Missing browser storage should behave the same as a cache miss.
        }

        if (cancelled) return
        const promptKey = `${dataframeKey}:${filename}`
        if (!dismissedDatasourcePrompts[promptKey]) {
          setDatasourcePrompt((current) => current ?? { dataframeIndex, dataframeKey, filename })
          return
        }
      }
    }

    void restoreCachedDatasources()

    return () => {
      cancelled = true
    }
  }, [dismissedDatasourcePrompts, missingDatasourceDataframes])
  useEffect(() => {
    window.localStorage.setItem(UI_THEME_STORAGE_KEY, uiTheme)
    applyUITheme(uiTheme)
    if (uiTheme !== 'system') return
    return subscribeToSystemTheme((systemPrefersDark) => applyUITheme('system', document.documentElement, systemPrefersDark))
  }, [uiTheme])
  // Jump to the active frame once when the JSON editor opens (not on every keystroke).
  useEffect(() => {
    const textarea = jsonTextareaRef.current
    const offset = jsonJumpOffsetRef.current
    if (!showJson || !textarea || offset < 0) return
    jsonJumpOffsetRef.current = -1
    textarea.focus()
    textarea.setSelectionRange(offset, offset)
    const line = textarea.value.slice(0, offset).split('\n').length
    const top = Math.max(0, (line - 6) * JSON_EDITOR_LINE_HEIGHT)
    textarea.scrollTop = top
    if (jsonOverlayRef.current) {
      jsonOverlayRef.current.scrollTop = top
    }
  }, [showJson])
  const plotConfigActions = usePlotConfigActions({ activeDataframeIndex, activeFrameIndex, setActiveDataframeIndex, setActiveFrameIndex, setPlotConfig, setShowGenerateColorsConfirm })
  const { addAxis, addDataframe, addFrame, addGuideline, addLayer, duplicateDataframe, duplicateFrame, generateMaterialColors, moveFrame, patchActiveDataframe, patchActiveFrame, patchDataframe, removeAxis, removeDataframe, removeFrame, reorderDataframes, toggleDataframeGeneration, toggleFrameGeneration, updateAxis, updateGuideline } = plotConfigActions
  const importDatabase = async (file?: File) => {
    setImportInProgress(true)
    const selectedDataframe = activeDataframe
    const selectedDataframeKey = activeDataframeKey
    const selectedSourceMode = getSourceMode(selectedDataframe, availableDatasets ?? [])
    const sourceLabel = selectedSourceMode === 'teable' ? 'Teable' : selectedSourceMode === 'dataset' ? t('datasetName') : 'Excel'
    const logTitle = `${sourceLabel}: ${file?.name ?? (selectedSourceMode === 'teable' ? selectedDataframe.teableUrl : selectedDataframe.importFileName) ?? '–'}`
    const startedAt = performance.now()
    try {
      if (selectedSourceMode === 'dataset' && !selectedDataframe.importFileName) {
        throw new Error(t('selectDatasetFirst'))
      }
      const response = await fetchBackend('/api/import-database', {
        method: 'POST',
        headers: selectedSourceMode === 'teable' ? { 'Content-Type': 'application/json' } : undefined,
        body:
          selectedSourceMode === 'teable'
            ? JSON.stringify({
              API_Key: selectedDataframe.apiKey,
              teable_url: selectedDataframe.teableUrl,
              import_sheet: selectedDataframe.importSheet,
            })
            : selectedSourceMode === 'dataset'
              ? (() => {
                const form = new FormData()
                form.append('import_file_name', selectedDataframe.importFileName ?? '')
                form.append('import_sheet', String(selectedDataframe.importSheet))
                return form
              })()
              : (() => {
              const form = new FormData()
              if (file) {
                form.append('file', file)
              }
              form.append('import_sheet', String(selectedDataframe.importSheet))
              return form
            })(),
      }, { unreachable: t('backendUnreachable'), foreign: t('backendForeign'), timeoutMs: IMPORT_TIMEOUT_MS, timedOut: t('requestTimedOut', { seconds: IMPORT_TIMEOUT_MS / 1000 }) })
      const payload = (await response.json().catch(() => ({}))) as ImportDatabaseResponse
      if (!response.ok || payload.success === false) {
        // The dev proxy answers 502–504 without a body when the backend is down.
        const unreachable = !payload.message && [502, 503, 504].includes(response.status)
        throw new BackendError({ message: payload.message || (unreachable ? t('backendUnreachable') : t('importFailed', { status: response.status })), messages: [], status: response.status })
      }
      const columns = parseColumnsFromImportResult(payload.columns)
      const keywordsByColumn = payload.keywords_by_column ?? {}
      const sheetNames = payload.sheet_names ?? []
      const formatWarnings = parseFormatWarnings(payload.format_warnings)
      let cachingFailed = false
      if (file) {
        const filename = payload.import_file_name ?? file.name
        let cachedFile = file
        try {
          cachedFile = await toMemoryFile(file, filename)
          await cacheDatasourceFile(cachedFile, filename)
          setDismissedDatasourcePrompts((current) => {
            const next = { ...current }
            delete next[`${selectedDataframeKey}:${cachedFile.name}`]
            return next
          })
        } catch {
          cachingFailed = true
        }
        setDatasourceFilesByKey((current) => ({
          ...current,
          [selectedDataframeKey]: cachedFile,
        }))
      }
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
      for (const layer of activeDataframe.frames.flatMap((frame) => frame.layers)) {
        if (layer.name && !allowedLayerColumns.has(layer.name)) {
          unknownColumns.add(layer.name)
        }
      }
      patchActiveDataframe((df) => ({
        ...df,
        importFileName: payload.import_file_name ?? file?.name ?? df.importFileName,
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
      setImportedStatusByKey((current) => ({
        ...current,
        [selectedDataframeKey]: { imported: true, source: selectedSourceMode },
      }))
      setImportedSources((current) => ({
        ...current,
        [selectedDataframeKey]: { columns, keywordsByColumn, sheets: sheetNames, formatWarnings },
      }))
      importedSignaturesRef.current.set(selectedDataframeKey, sourceSignature(selectedSourceMode, payload.import_file_name ?? file?.name ?? selectedDataframe.importFileName, selectedDataframe.importSheet))
      const messageParts = [
        columns.length > 0 ? t('importSuccessColumns', { source: sourceLabel, count: columns.length }) : t('importSuccess', { source: sourceLabel }),
        payload.message ?? '',
        unknownColumns.size > 0 ? t('unavailableColumnsRemoved', { columns: [...unknownColumns].sort((a, b) => a.localeCompare(b)).join(', ') }) : '',
        cachingFailed ? t('datasourceNotCached') : '',
      ]
      // Formatting problems of the sheet do not stop the import; they are listed in the Data section.
      if (formatWarnings.length > 0) messageParts.push(t('formatWarningsImported', { source: sourceLabel, count: formatWarnings.length }))
      const successMessage = messageParts.filter(Boolean).join(' ')
      setAlert({ tone: formatWarnings.length > 0 ? 'warning' : 'success', message: successMessage })
      addLogEntry({
        level: unknownColumns.size > 0 || cachingFailed || formatWarnings.length > 0 ? 'warning' : 'info',
        source: 'import',
        title: logTitle,
        message: successMessage,
        messages: formatWarnings.map((warning) => describeFormatWarning(warning, t)),
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      })
    } catch (error) {
      const details = toErrorDetails(error, t('importFailedGeneric'))
      addLogEntry({ level: 'error', source: 'import', title: logTitle, ...details, durationMs: Math.round(performance.now() - startedAt) })
      setAlert({ tone: 'error', message: details.message })
    } finally {
      setImportInProgress(false)
    }
  }
  // Imports the source of the active dataframe automatically (a provided dataset, or an Excel file
  // restored from browser storage), once per source.
  useEffect(() => {
    if (availableDatasets === null) return
    const sourceMode = getSourceMode(activeDataframe, availableDatasets)
    if (sourceMode === 'teable' || !activeDataframe.importFileName) return
    const signature = sourceSignature(sourceMode, activeDataframe.importFileName, activeDataframe.importSheet)
    if (importedSignaturesRef.current.get(activeDataframeKey) === signature) return
    const cachedFile = datasourceFilesByDataframe[activeDataframeIndex]
    if (sourceMode === 'file' && cachedFile?.name !== activeDataframe.importFileName) return
    importedSignaturesRef.current.set(activeDataframeKey, signature)
    void importDatabase(sourceMode === 'file' ? cachedFile : undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDataframeKey, activeDataframe.importFileName, activeDataframe.importSheet, activeDataframe._extensions.source_mode, availableDatasets, datasourceFilesByDataframe])
  const updateLanguages = (next: string[]) => {
    const sanitized = normalizePlotLanguages(activeDataframe.plotLanguages, next)
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
    const nextLanguages = addPlotLanguageToList(activeDataframe.plotLanguages, language)
    if (nextLanguages === activeDataframe.plotLanguages) return
    updateLanguages(nextLanguages)
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
      const imported = parseImportedConfig(await file.text(), true)
      const importedVersion = getConfigVersion(imported)
      const normalized = normalizePlotConfig(imported)
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
      setDatasourceFilesByKey({})
      setDatasourcePrompt(null)
      setDismissedDatasourcePrompts({})
      setImportedStatusByKey({})
      setConfigBaseName(file.name.replace(/\.[^.]+$/, '') || 'ashby-config')
      setImportedSources({})
      importedSignaturesRef.current.clear()
      // Another format version is imported anyway (unknown settings are kept as they are), with a warning.
      setAlert({ tone: 'success', message: t('configImported', { name: file.name }) })
      if (importedVersion === CONFIG_VERSION) {
        setConfigWarning(null)
      } else {
        const message = importedVersion === undefined
          ? t('configVersionMissing', { name: file.name, current: CONFIG_VERSION })
          : t('configVersionMismatch', { name: file.name, version: importedVersion, current: CONFIG_VERSION })
        setConfigWarning(message)
        addLogEntry({ level: 'warning', source: 'config', title: file.name, message })
      }
    } catch (error) {
      const details = toErrorDetails(error, t('invalidConfigFile'))
      addLogEntry({ level: 'error', source: 'config', title: file.name, ...details })
      setAlert({ tone: 'error', message: t('invalidConfigFileDetails', { error: details.message }) })
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
  const closeDatasourcePrompt = () => {
    if (datasourcePrompt) {
      setDismissedDatasourcePrompts((current) => ({
        ...current,
        [`${datasourcePrompt.dataframeKey}:${datasourcePrompt.filename}`]: true,
      }))
    }
    setDatasourcePrompt(null)
  }
  const handleDatasourcePromptFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const prompt = datasourcePrompt
    event.target.value = ''
    if (!file || !prompt) return

    try {
      const cachedFile = await cacheDatasourceFile(file, prompt.filename)
      setDatasourceFilesByKey((current) => ({
        ...current,
        [prompt.dataframeKey]: cachedFile,
      }))
      setImportedStatusByKey((current) => ({
        ...current,
        [prompt.dataframeKey]: { imported: true, source: 'file' },
      }))
      setDismissedDatasourcePrompts((current) => {
        const next = { ...current }
        delete next[`${prompt.dataframeKey}:${prompt.filename}`]
        return next
      })
      setDatasourcePrompt(null)
      setAlert({ tone: 'success', message: t('datasourceLoaded', { name: prompt.filename }) })
    } catch (error) {
      setAlert({
        tone: 'error',
        message: error instanceof Error ? error.message : t('datasourceCacheFailed', { name: prompt.filename }),
      })
    }
  }
  const openTabWithSelection = (dataframeIndex: number, frameIndex: number) => {
    const params = new URLSearchParams(window.location.search)
    params.set('dataframe', String(dataframeIndex))
    params.set('frame', String(frameIndex))
    params.set(VIEW_URL_PARAM, 'editor')
    // No 'noopener': the new tab must inherit this tab's sessionStorage copy of the config.
    window.open(`${window.location.pathname}?${params.toString()}`, '_blank')
  }
  const applyTabRename = () => {
    if (!tabRename) return
    const trimmed = tabRename.value.trim()
    if (tabRename.type === 'dataframe') {
      patchDataframe(tabRename.index, (df) => ({ ...df, name: trimmed || undefined }))
    } else {
      patchActiveDataframe((df) => ({
        ...df,
        frames: df.frames.map((frame, index) => (index === tabRename.index ? { ...frame, name: trimmed || undefined } : frame)),
      }))
    }
    setTabRename(null)
  }
  const openJsonEditor = () => {
    setJsonDraft(JSON.stringify(toExternalConfig(plotConfig), null, 2))
    jsonJumpOffsetRef.current = findExternalFrameOffset(plotConfig, activeDataframeIndex, activeFrameIndex)
    setShowJson(true)
  }
  const applyJsonEditor = () => {
    try {
      setPlotConfig(normalizePlotConfig(parseImportedConfig(jsonDraft, true)))
      setAlert({ tone: 'success', message: t('jsonApplied') })
      setShowJson(false)
    } catch (error) {
      const details = toErrorDetails(error, t('jsonInvalid'))
      addLogEntry({ level: 'error', source: 'config', title: t('jsonEditor'), ...details })
      setAlert({ tone: 'error', message: t('jsonInvalidDetails', { error: details.message }) })
    }
  }
  const clearStoredDatasourceFiles = async () => {
    try {
      await clearCachedDatasourceFiles()
      setDatasourceFilesByKey({})
      setImportedStatusByKey({})
      setDatasourcePrompt(null)
      setDismissedDatasourcePrompts({})
      setAlert({ tone: 'success', message: t('storedFilesCleared') })
    } catch (error) {
      setAlert({
        tone: 'error',
        message: error instanceof Error ? error.message : t('storedFilesClearFailed'),
      })
    }
  }
  const jsonMarker = useMemo(() => getJsonSyntaxMarkers(jsonDraft), [jsonDraft])
  const resetConfig = () => {
    setPlotConfig(normalizePlotConfig())
    setConfigWarning(null)
    setConfigBaseName('ashby-config')
    setActiveDataframeIndex(0)
    setActiveFrameIndex(0)
    setImportedSources({})
    importedSignaturesRef.current.clear()
    setDatasourceFilesByKey({})
    setDatasourcePrompt(null)
    setDismissedDatasourcePrompts({})
    setImportedStatusByKey({})
    setShowResetConfirm(false)
  }
  // Settings navigation: modes, sections, jumping to fields, required settings.
  const changeSettingsMode = useCallback((mode: SettingsMode) => {
    setSettingsMode(mode)
    writeStored(SETTINGS_MODE_STORAGE_KEY, mode)
    // A section that Simple mode hides cannot stay open.
    setActiveSection((current) => (isHiddenInMode(current, mode) ? 'data' : current))
  }, [])
  const toggleSectionDefaults = (id: SettingsSectionId) =>
    setShownDefaults((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  /** Opens a section, shows the field (its defaults, a collapsed item) and highlights it. */
  const revealSetting = useCallback((section: SettingsSectionId, element: HTMLElement) => {
    // Jumping to a setting of a section that Simple mode hides (search, links) switches to All settings.
    if (isHiddenInMode(section, settingsMode)) changeSettingsMode('all')
    setActiveSection(section)
    pinnedSectionRef.current = section
    if (element.closest('[data-level="default"]')) {
      setShownDefaults((current) => (current.has(section) ? current : new Set([...current, section])))
    }
    element.dispatchEvent(new CustomEvent('settings-reveal', { bubbles: true }))
    // After React has shown the section and the field.
    window.setTimeout(() => {
      element.scrollIntoView({ block: 'center' })
      element.classList.remove('setting-flash')
      void element.offsetWidth
      element.classList.add('setting-flash')
      element.addEventListener('animationend', () => element.classList.remove('setting-flash'), { once: true })
    }, 50)
  }, [settingsMode, changeSettingsMode])
  const goTo = useCallback((section: SettingsSectionId, anchor?: string) => {
    if (isHiddenInMode(section, settingsMode)) changeSettingsMode('all')
    setActiveSection(section)
    // Keep the clicked section highlighted even if the column cannot scroll it to the top (the last ones).
    pinnedSectionRef.current = section
    if (!anchor) {
      if (scrollSections) editorRef.current?.querySelector(`[data-section-id="${section}"]`)?.scrollIntoView({ block: 'start' })
      else editorRef.current?.scrollTo({ top: 0 })
      return
    }
    const candidates = [...(editorRef.current?.querySelectorAll<HTMLElement>(`[data-section-id="${section}"] [data-anchor="${anchor}"]`) ?? [])]
    // Prefer the field that is visible in the current mode (e.g. the Simple-mode shortcut).
    // (A field of a section that is still hidden has no layout yet.)
    const target = candidates.find((element) => element.getClientRects().length > 0 || element.closest('[data-section-id]')?.hasAttribute('hidden')) ?? candidates[0]
    if (target) revealSetting(section, target)
  }, [revealSetting, scrollSections, settingsMode, changeSettingsMode])
  // In the scrolling column the sidebar follows the scroll position: the active section is the last one whose top has
  // passed the upper quarter of the editor column.
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !scrollSections) return
    let frame = 0
    const update = () => {
      frame = 0
      if (pinnedSectionRef.current) return
      const line = editor.getBoundingClientRect().top + editor.clientHeight / 4
      let current: SettingsSectionId | null = null
      // Sections hidden in Simple mode have no position.
      for (const element of editor.querySelectorAll<HTMLElement>('[data-section-id]:not([hidden])')) {
        const id = element.dataset.sectionId ?? ''
        if (!isSettingsSectionId(id)) continue
        if (current === null || element.getBoundingClientRect().top <= line) current = id
      }
      if (editor.scrollTop + editor.clientHeight >= editor.scrollHeight - 2) {
        const sections = editor.querySelectorAll<HTMLElement>('[data-section-id]:not([hidden])')
        const last = sections[sections.length - 1]?.dataset.sectionId ?? ''
        if (isSettingsSectionId(last)) current = last
      }
      if (current) setActiveSection(current)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    // A scroll by the user (not by a jump from the sidebar) releases the pinned section.
    const release = () => { pinnedSectionRef.current = null }
    editor.addEventListener('scroll', onScroll, { passive: true })
    for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) editor.addEventListener(type, release, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      editor.removeEventListener('scroll', onScroll)
      for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) editor.removeEventListener(type, release)
    }
  }, [scrollSections])
  const settingsContext = useMemo(() => ({ mode: settingsMode, goTo }), [settingsMode, goTo])
  const selectPlot = (dataframeIndex: number, frameIndex: number) => {
    if (dataframeIndex !== activeDataframeIndex) setExpandedAxisColumns({})
    setActiveDataframeIndex(dataframeIndex)
    setActiveFrameIndex(frameIndex)
  }
  const isSourceFileAvailable = (dataframeIndex: number) => {
    const dataframe = plotConfig.dataframes[dataframeIndex]
    return Boolean(dataframe?.importFileName) && datasourceFilesByDataframe[dataframeIndex]?.name === dataframe?.importFileName
  }
  const dataframeMissing = (dataframeIndex: number) => {
    const dataframe = plotConfig.dataframes[dataframeIndex]
    return dataframe ? getDataframeMissing(dataframe, availableDatasets ?? [], isSourceFileAvailable(dataframeIndex)) : []
  }
  const activeDataframeMissing = dataframeMissing(activeDataframeIndex)
  const activeFrameMissing = getFrameMissing(activeFrame)
  const activeMissing = [...activeDataframeMissing, ...activeFrameMissing]
  const sectionStatus = (section: SettingsSectionId): SectionStatus => {
    const base: SectionStatus = { missing: activeMissing.filter((entry) => entry.section === section).length }
    if (section === 'axisDefs') {
      const incomplete = activeDataframe.axes.filter((axis) => !axis.name.trim() || axis.columns.length === 0).length
      return { ...base, missing: activeDataframe.axes.length === 0 ? 1 : incomplete }
    }
    if (section === 'extras') return { ...base, items: activeFrame.coloredAreas.length + activeFrame.guidelines.length + Math.max(0, activeFrame.annotations.length - 1) }
    return base
  }
  const activeSectionScope = SETTINGS_SECTIONS.find((section) => section.id === activeSection)?.scope

  // Widths of the settings list and the preview: dragged with the dividers, reset by double-click, kept in localStorage.
  // Each keeps the editor between them at least MIN_EDITOR_WIDTH wide.
  const workBox = () => workRef.current?.getBoundingClientRect() ?? { left: 0, right: window.innerWidth, width: window.innerWidth }
  const clampPreviewWidth = (width: number) =>
    Math.round(Math.min(Math.max(MIN_PREVIEW_WIDTH, workBox().width - navWidth - MIN_EDITOR_WIDTH), Math.max(MIN_PREVIEW_WIDTH, width)))
  const clampNavWidth = (width: number) =>
    Math.round(Math.min(MAX_NAV_WIDTH, Math.max(MIN_NAV_WIDTH, workBox().width - previewWidth - MIN_EDITOR_WIDTH), Math.max(MIN_NAV_WIDTH, width)))
  const commitPreviewWidth = (width: number) => {
    const next = clampPreviewWidth(width)
    setPreviewWidth(next)
    writeStored(PREVIEW_WIDTH_STORAGE_KEY, String(next))
  }
  const commitNavWidth = (width: number) => {
    const next = clampNavWidth(width)
    setNavWidth(next)
    writeStored(NAV_WIDTH_STORAGE_KEY, String(next))
  }

  const tabProps = {
    plotConfig,
    activeDataframeIndex,
    activeFrameIndex,
    highlightShared: activeSectionScope === 'dataset',
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
    frameMissingCount: (dataframeIndex: number, frameIndex: number) => {
      const frame = plotConfig.dataframes[dataframeIndex]?.frames[frameIndex]
      return frame ? getFrameMissing(frame).length : 0
    },
    dataframeMissingCount: (dataframeIndex: number) => dataframeMissing(dataframeIndex).length,
    onGenerateAll: () => {
      setPlotAction('create-all')
      setPlotActionNonce((current) => current + 1)
    },
  }
  const sectionProps = { activeDataframe, activeDataframeIndex, activeFrame, addAxis, addGuideline, addLayer, addPlotLanguage, availableAxisColumns, availableColumns, availableDatasets: availableDatasets ?? [], availableSheets: activeImportedSource?.sheets ?? [], formatWarnings: activeImportedSource?.formatWarnings ?? EMPTY_FORMAT_WARNINGS, availableKeywordsByColumn, availableWhitelistKeywords, customMaterialNames, expandedAxisColumns, expandedLayerKeywords, handlePlotLanguageKeyDown, handleSpreadsheetSelection, importDatabase, importInProgress, importedDatabaseStatus: displayedImportedDatabaseStatus, includedLayerKeywords, layerNameOptions, materialColors: activeDataframe.materialColors, materialKeywordOptions, patchActiveDataframe, patchActiveFrame, plotLanguageDraft, removeAxis, setCustomMaterialNames, setExpandedAxisColumns, setExpandedLayerKeywords, setPlotLanguageDraft, setShowGenerateColorsConfirm, updateAxis, updateGuideline, updateLanguages, uploadInputRef,
    sourceMissing: activeDataframeMissing.some((entry) => entry.section === 'data'),
    onImportConfig: () => fileInputRef.current?.click(),
    onExportConfig: () => exportConfig(plotConfig, configBaseName),
    onResetConfig: () => setShowResetConfirm(true),
    activeSection,
    scrollSections,
    shownDefaults,
    onToggleDefaults: toggleSectionDefaults,
  }
  const settingsContent = (
    <>
      <SettingsRow label={t('uiLanguage')}>
        <Select className="w-40" value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value as UILanguage)}>
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </Select>
      </SettingsRow>
      <SettingsRow label={t('uiTheme')}>
        <Toggle<UIThemePreference>
          ariaLabel={t('uiTheme')}
          value={uiTheme}
          onChange={setUiTheme}
          options={[
            { value: 'system', label: t('themeSystem') },
            { value: 'light', label: t('themeLight') },
            { value: 'dark', label: t('themeDark') },
          ]}
        />
      </SettingsRow>
      <SettingsRow label={t('scrollSections')} hint={t('scrollSectionsHint')}>
        <Switch
          checked={scrollSections}
          label={t('scrollSections')}
          onChange={(next) => {
            setScrollSections(next)
            writeStored(SCROLL_SECTIONS_STORAGE_KEY, String(next))
          }}
        />
      </SettingsRow>
      <SettingsRow label={t('attributionKey')} hint={t('attributionKeyHint')}>
        <AttributionKeySetting />
      </SettingsRow>
      <SettingsRow label={t('localDataFiles')}>
        <Button type="button" variant="outline" size="sm" onClick={() => { void clearStoredDatasourceFiles() }}>
          {t('deleteStoredFiles')}
        </Button>
      </SettingsRow>
    </>
  )
  return (
    <I18nContext.Provider value={i18n}>
    <SettingsContext.Provider value={settingsContext}>
    <div className={cn('flex min-h-svh flex-col text-left lg:h-svh', settingsMode === 'simple' ? 'settings-simple' : 'settings-all')}>
      <AppHeader mode={settingsMode} setMode={changeSettingsMode} openJsonEditor={openJsonEditor} setShowAbout={setShowAbout} setShowSettings={setShowSettings} showOverview={showOverview} onShowOverview={() => setShowOverview(true)} />
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
      {showOverview ? <OverviewPage onOpenEditor={() => setShowOverview(false)} onOpenPrivacy={() => setShowPrivacy(true)} /> : (<>
        {backendAvailable === false ? (
          <div className="px-4 pt-3">
            <Alert variant="warning">{backendForeign ? t('backendForeign') : t('backendUnavailable')}</Alert>
          </div>
        ) : null}
        {missingDatasourceDataframes.length > 0 ? (
          <div className="px-4 pt-3">
            <Alert variant="warning">
              {t('datasourceMissing', { list: missingDatasourceDataframes.map(({ dataframe, dataframeIndex }) => t('datasourceMissingItem', { n: dataframeIndex + 1, filename: dataframe.importFileName ?? '' })).join(', ') })}
            </Alert>
          </div>
        ) : null}
        <ConfigTabs {...tabProps} />
        {/* Notices close themselves (messages stay in the log); warnings and errors stay longer. */}
        {configWarning ? (
          <div className="px-4 pt-3">
            <TimedAlert variant="warning" seconds={NOTICE_SECONDS.warning} onClose={() => setConfigWarning(null)} closeLabel={t('closeNotification')} resetKey={configWarning}>
              {configWarning}
            </TimedAlert>
          </div>
        ) : null}
        {alert ? (
          <div className="px-4 pt-3">
            <TimedAlert variant={alert.tone === 'error' ? 'destructive' : alert.tone} seconds={NOTICE_SECONDS[alert.tone]} onClose={() => setAlert(null)} closeLabel={t('closeNotification')} resetKey={alert}>
              {alert.message}
            </TimedAlert>
          </div>
        ) : null}
        <div
          ref={workRef}
          style={{ '--nav-width': `${navWidth}px`, '--preview-width': `${previewWidth}px` } as CSSProperties}
          className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[var(--nav-width)_1px_minmax(0,1fr)_9px_var(--preview-width)]"
        >
          <SettingsNav
            mode={settingsMode}
            activeSection={activeSection}
            onSelect={(section) => goTo(section)}
            onReveal={revealSetting}
            statusFor={sectionStatus}
            dataframeName={dataframeLabel(activeDataframe, activeDataframeIndex)}
            frameName={activeFrame.name || `Frame ${activeFrameIndex + 1}`}
            editorRef={editorRef}
          />
          <ResizeDivider
            label={t('resizeNav')}
            hint={t('resizeNavHint')}
            width={navWidth}
            widthAt={(clientX) => clientX - workBox().left}
            growKey="ArrowRight"
            onResize={(width) => setNavWidth(clampNavWidth(width))}
            onCommit={commitNavWidth}
            defaultWidth={DEFAULT_NAV_WIDTH}
            thin
          />
          <main ref={editorRef} className="min-h-0 min-w-0 overflow-auto px-6 pb-10 pt-5">
            <div className="@container mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-5">
              <ConfigSections {...sectionProps} />
            </div>
          </main>
          <ResizeDivider
            label={t('resizePreview')}
            hint={t('resizePreviewHint')}
            width={previewWidth}
            widthAt={(clientX) => workBox().right - clientX - 4}
            growKey="ArrowLeft"
            onResize={(width) => setPreviewWidth(clampPreviewWidth(width))}
            onCommit={commitPreviewWidth}
            defaultWidth={DEFAULT_PREVIEW_WIDTH}
          />
          <PlotPage plotConfig={plotConfig} configBaseName={configBaseName} activeDataframeIndex={activeDataframeIndex} activeFrameIndex={activeFrameIndex} plotAction={plotAction} plotActionNonce={plotActionNonce} datasourceFilesByDataframe={datasourceFilesByDataframe} availableDatasets={availableDatasets}
            missing={activeMissing}
            onJump={goTo}
            autoRefresh={autoRefresh}
            onAutoRefreshChange={(next) => {
              setAutoRefresh(next)
              writeStored(AUTO_REFRESH_STORAGE_KEY, String(next))
            }}
          />
        </div>
      </>)}
      <AppPopouts
        showAbout={showAbout}
        showSettings={showSettings}
        showGenerateColorsConfirm={showGenerateColorsConfirm}
        showJson={showJson}
        showResetConfirm={showResetConfirm}
        datasourcePrompt={showOverview ? null : datasourcePrompt}
        jsonFullscreen={jsonFullscreen}
        jsonDraft={jsonDraft}
        jsonMarker={jsonMarker}
        settingsContent={settingsContent}
        onCloseAbout={() => setShowAbout(false)}
        onOpenPrivacy={() => {
          setShowAbout(false)
          setShowPrivacy(true)
        }}
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
        onConfirmReset={resetConfig}
        onCloseDatasourcePrompt={closeDatasourcePrompt}
        onDatasourcePromptFile={handleDatasourcePromptFile}
        jsonOverlayRef={jsonOverlayRef}
        jsonTextareaRef={jsonTextareaRef}
      />
      {showPrivacy ? <PrivacyDialog onClose={closePrivacy} /> : null}
    </div>
    </SettingsContext.Provider>
    </I18nContext.Provider>
  )
}
export default App
