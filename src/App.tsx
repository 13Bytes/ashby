import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { PlotPage } from './components/PlotPage'
import { Alert } from './components/ui/alert'
import { Button } from './components/ui/button'
import { normalizePlotConfig } from './config/configMappers'
import type { PlotConfig } from './config/defaultPlotConfig'
import { findExternalFrameOffset, parseImportedConfig, toExternalConfig } from './utils/configIo'
import { Select } from './components/ui/select'
import { createTranslator, I18nContext, readStoredUILanguage, UI_LANGUAGE_STORAGE_KEY, type UILanguage } from './uiTranslations'
import { AppPopouts } from './components/AppPopouts'
import { addPlotLanguageToList, normalizePlotLanguages } from './utils/plotLanguages'
import { AppHeader } from './components/AppHeader'
import { ConfigSections } from './components/ConfigSections'
import { ConfigTabs } from './components/ConfigTabs'
import { Field } from './components/AppControls'
import { getAxisBasesFromColumns, getConfigLanguages, getConfigWhitelistKeywords, getSourceMode, getUiKey, parseColumnsFromImportResult, type SourceMode } from './utils/appState'
import { getJsonSyntaxMarkers } from './utils/jsonHighlight'
import { usePlotConfigActions } from './hooks/usePlotConfigActions'
import { applyUITheme, readStoredUITheme, subscribeToSystemTheme, UI_THEME_STORAGE_KEY, type UIThemePreference } from './utils/uiTheme'
import { cacheDatasourceFile, clearCachedDatasourceFiles, getCachedDatasourceFile } from './utils/datasourceStorage'
import { createConfigSync, type ConfigSync } from './utils/tabSync'

type AppPage = 'config' | 'plot'
type AlertTone = 'success' | 'error'; interface AlertState { tone: AlertTone; message: string }
type PlotAction = 'preview-current' | 'create-all'

type ImportDatabaseResponse = { columns?: string[]; keywords_by_column?: Record<string, string[]>; import_file_name?: string; message?: string; success?: boolean; sheet_names?: string[] }
/** What the last datasource import of a dataframe returned; kept per dataframe (by UI key). */
type ImportedSource = { columns: string[]; keywordsByColumn: Record<string, string[]>; sheets: string[] }
const EMPTY_KEYWORDS: Record<string, string[]> = {}

const CONFIG_STORAGE_KEY = 'ashby-plot-config'
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

function App() {
  const [plotConfig, setPlotConfig] = useState<PlotConfig>(readStoredPlotConfig)
  const [configBaseName, setConfigBaseName] = useState('ashby-config')
  const [activePage, setActivePage] = useState<AppPage>('config')
  const [activeDataframeIndex, setActiveDataframeIndex] = useState(0)
  const [activeFrameIndex, setActiveFrameIndex] = useState(0)
  const [hoveredRemoveGroup, setHoveredRemoveGroup] = useState<string | null>(null)
  const [hoveredDuplicateGroup, setHoveredDuplicateGroup] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [jsonDraft, setJsonDraft] = useState('')
  const [alert, setAlert] = useState<AlertState | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const jsonTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const jsonOverlayRef = useRef<HTMLPreElement | null>(null)
  const jsonJumpOffsetRef = useRef(-1)
  const datasetAutoImportRef = useRef<string | null>(null)
  const fileAutoImportRef = useRef<string | null>(null)
  const [plotLanguageDraft, setPlotLanguageDraft] = useState('')
  const [uiLanguage, setUiLanguage] = useState<UILanguage>(readStoredUILanguage)
  const [uiTheme, setUiTheme] = useState<UIThemePreference>(() => readStoredUITheme())
  const [importedSources, setImportedSources] = useState<Record<string, ImportedSource>>({})
  const [importInProgress, setImportInProgress] = useState(false)
  const [tabRename, setTabRename] = useState<{ type: 'dataframe' | 'frame'; index: number; value: string } | null>(null)
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
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null)
  const [availableDatasets, setAvailableDatasets] = useState<string[] | null>(null)
  const [datasourceFilesByDataframe, setDatasourceFilesByDataframe] = useState<Record<number, File>>({})
  const [datasourcePrompt, setDatasourcePrompt] = useState<{ dataframeIndex: number; filename: string } | null>(null)
  const [dismissedDatasourcePrompts, setDismissedDatasourcePrompts] = useState<Record<string, boolean>>({})
  const activeDataframe = plotConfig.dataframes[activeDataframeIndex] ?? plotConfig.dataframes[0]
  const activeFrame = activeDataframe.frames[activeFrameIndex] ?? activeDataframe.frames[0]
  const automaticDisplayAreaActive = activeFrame.automaticDisplayAreaMargin !== null
  const i18n = useMemo(() => ({ language: uiLanguage, t: createTranslator(uiLanguage) }), [uiLanguage])
  const { t } = i18n
  const configSyncRef = useRef<ConfigSync | null>(null)
  const lastSyncedConfigRef = useRef<string | null>(null)
  const activeDataframeKey = getUiKey(activeDataframe, 'dataframe')
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
  // Live sync with tabs of the same workspace (see utils/tabSync.ts).
  useEffect(() => {
    const sync = createConfigSync((serialized) => {
      try {
        const next = normalizePlotConfig(parseImportedConfig(serialized))
        // Remember what we received so the save effect below does not echo it back.
        lastSyncedConfigRef.current = JSON.stringify(toExternalConfig(next))
        setPlotConfig(next)
      } catch {
        // ignore malformed messages
      }
    })
    configSyncRef.current = sync
    return () => {
      sync.close()
      configSyncRef.current = null
    }
  }, [])
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
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [activeDataframeIndex, activeFrameIndex])
  useEffect(() => {
    if (!alert) return
    const timeout = window.setTimeout(() => setAlert(null), 15000)
    return () => window.clearTimeout(timeout)
  }, [alert])
  useEffect(() => {
    let active = true
    const checkBackendAvailability = async () => {
      try {
        const response = await fetch('/api/health', { cache: 'no-store' })
        if (active) setBackendAvailable(response.ok)
      } catch {
        if (active) setBackendAvailable(false)
      }
    }
    void checkBackendAvailability()
    const interval = window.setInterval(checkBackendAvailability, 15000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])
  useEffect(() => {
    let active = true
    const loadDatasets = async () => {
      try {
        const response = await fetch('/api/import-database/datasets', { cache: 'no-store' })
        const payload = await response.json().catch(() => ({})) as { datasets?: unknown }
        if (active) {
          setAvailableDatasets(Array.isArray(payload.datasets) ? payload.datasets.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : [])
        }
      } catch {
        if (active) {
          setAvailableDatasets([])
        }
      }
    }

    void loadDatasets()
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    let cancelled = false

    const restoreCachedDatasources = async () => {
      for (const { dataframe, dataframeIndex } of missingDatasourceDataframes) {
        const filename = dataframe.importFileName?.trim()
        if (!filename) continue

        try {
          const cachedFile = await getCachedDatasourceFile(filename)
          if (cancelled) return

          if (cachedFile) {
            setDatasourceFilesByDataframe((current) => current[dataframeIndex]?.name === cachedFile.name ? current : { ...current, [dataframeIndex]: cachedFile })
            setImportedDatabaseStatus((current) => ({
              ...current,
              [dataframeIndex]: { imported: true, source: 'file' },
            }))
            continue
          }
        } catch {
          // Missing browser storage should behave the same as a cache miss.
        }

        if (cancelled) return
        const promptKey = `${dataframeIndex}:${filename}`
        if (!dismissedDatasourcePrompts[promptKey]) {
          setDatasourcePrompt((current) => current ?? { dataframeIndex, filename })
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
  useEffect(() => {
    setMoveFrameTargetDataframe(String(activeDataframeIndex))
  }, [activeDataframeIndex])
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
  const plotConfigActions = usePlotConfigActions({ activeDataframe, activeDataframeIndex, activeFrameIndex, setActiveDataframeIndex, setActiveFrameIndex, setPlotConfig, setShowGenerateColorsConfirm })
  const { addAxis, addDataframe, addFrame, addGuideline, addLayer, duplicateDataframe, duplicateFrame, generateMaterialColors, moveFrameToDataframe, patchActiveDataframe, patchActiveFrame, patchDataframe, removeAxis, removeDataframe, removeFrame, reorderDataframes, reorderFrames, toggleDataframeGeneration, toggleFrameGeneration, updateAxis, updateGuideline } = plotConfigActions
  const importDatabase = async (file?: File) => {
    setImportInProgress(true)
    const selectedDataframe = activeDataframe
    const selectedDataframeKey = activeDataframeKey
    const selectedSourceMode = getSourceMode(selectedDataframe, availableDatasets ?? [])
    try {
      if (selectedSourceMode === 'dataset' && !selectedDataframe.importFileName) {
        throw new Error(t('selectDatasetFirst'))
      }
      const response = await fetch('/api/import-database', {
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
      })
      const payload = (await response.json().catch(() => ({}))) as ImportDatabaseResponse
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || t('importFailed', { status: response.status }))
      }
      const columns = parseColumnsFromImportResult(payload.columns)
      const keywordsByColumn = payload.keywords_by_column ?? {}
      const sheetNames = payload.sheet_names ?? []
      let cachingFailed = false
      if (file) {
        let cachedFile = file
        try {
          cachedFile = await cacheDatasourceFile(file, payload.import_file_name ?? file.name)
          setDismissedDatasourcePrompts((current) => {
            const next = { ...current }
            delete next[`${activeDataframeIndex}:${cachedFile.name}`]
            return next
          })
        } catch {
          cachingFailed = true
        }
        setDatasourceFilesByDataframe((current) => ({
          ...current,
          [activeDataframeIndex]: cachedFile,
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
      setImportedDatabaseStatus((current) => ({
        ...current,
        [activeDataframeIndex]: { imported: true, source: selectedSourceMode },
      }))
      setImportedSources((current) => ({
        ...current,
        [selectedDataframeKey]: { columns, keywordsByColumn, sheets: sheetNames },
      }))
      const sourceLabel = selectedSourceMode === 'teable' ? 'Teable' : selectedSourceMode === 'dataset' ? t('datasetName') : 'Excel'
      const messageParts = [
        columns.length > 0 ? t('importSuccessColumns', { source: sourceLabel, count: columns.length }) : t('importSuccess', { source: sourceLabel }),
        payload.message ?? '',
        unknownColumns.size > 0 ? t('unavailableColumnsRemoved', { columns: [...unknownColumns].sort((a, b) => a.localeCompare(b)).join(', ') }) : '',
        cachingFailed ? t('datasourceNotCached') : '',
      ]
      setAlert({ tone: 'success', message: messageParts.filter(Boolean).join(' ') })
    } catch (error) {
      setAlert({
        tone: 'error',
        message: error instanceof Error ? error.message : t('importFailedGeneric'),
      })
    } finally {
      setImportInProgress(false)
    }
  }
  useEffect(() => {
    if (availableDatasets === null) return
    const sourceMode = getSourceMode(activeDataframe, availableDatasets)
    
    if (sourceMode === 'dataset') {
      if (!activeDataframe.importFileName) return
      const key = `${activeDataframeIndex}:${activeDataframe.importFileName}:${activeDataframe.importSheet}`
      if (key === datasetAutoImportRef.current) return
      datasetAutoImportRef.current = key
      void importDatabase()
    } else if (sourceMode === 'file') {
      if (!activeDataframe.importFileName) return
      const cachedFile = datasourceFilesByDataframe[activeDataframeIndex]
      if (!cachedFile || cachedFile.name !== activeDataframe.importFileName) return
      
      const key = `${activeDataframeIndex}:${activeDataframe.importFileName}:${activeDataframe.importSheet}`
      if (key === fileAutoImportRef.current) return
      fileAutoImportRef.current = key
      void importDatabase(cachedFile)
    } else {
      datasetAutoImportRef.current = null
      fileAutoImportRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDataframeIndex, activeDataframe.importFileName, activeDataframe.importSheet, activeDataframe._extensions.source_mode, availableDatasets, datasourceFilesByDataframe])
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
      setDatasourceFilesByDataframe({})
      setDatasourcePrompt(null)
      setDismissedDatasourcePrompts({})
      setImportedDatabaseStatus({})
      setConfigBaseName(file.name.replace(/\.[^.]+$/, '') || 'ashby-config')
      setImportedSources({})
      setAlert({ tone: 'success', message: t('configImported', { name: file.name }) })
    } catch {
      setAlert({ tone: 'error', message: t('invalidConfigFile') })
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
        [`${datasourcePrompt.dataframeIndex}:${datasourcePrompt.filename}`]: true,
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
      setDatasourceFilesByDataframe((current) => ({
        ...current,
        [prompt.dataframeIndex]: cachedFile,
      }))
      setImportedDatabaseStatus((current) => ({
        ...current,
        [prompt.dataframeIndex]: { imported: true, source: 'file' },
      }))
      setDismissedDatasourcePrompts((current) => {
        const next = { ...current }
        delete next[`${prompt.dataframeIndex}:${prompt.filename}`]
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
    } catch {
      setAlert({ tone: 'error', message: t('jsonInvalid') })
    }
  }
  const clearStoredDatasourceFiles = async () => {
    try {
      await clearCachedDatasourceFiles()
      setDatasourceFilesByDataframe({})
      setImportedDatabaseStatus({})
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
    setConfigBaseName('ashby-config')
    setActiveDataframeIndex(0)
    setActiveFrameIndex(0)
    setImportedSources({})
    setDatasourceFilesByDataframe({})
    setDatasourcePrompt(null)
    setDismissedDatasourcePrompts({})
    setImportedDatabaseStatus({})
    setShowResetConfirm(false)
  }
  const headerProps  = { activePage, configBaseName, fileInputRef, handleImportFile, openJsonEditor, plotConfig, setActivePage, setPlotAction, setPlotActionNonce, setShowAbout, setShowResetConfirm, setShowSettings }
  const tabProps     = { activeDataframe, activeDataframeIndex, activeFrameIndex, addDataframe, addFrame, applyTabRename, dataframeDropIndex, draggedDataframeIndex, draggedFrameIndex, duplicateDataframe, duplicateFrame, frameDropIndex, moveFrameTargetDataframe, moveFrameToDataframe, openTabWithSelection, plotConfig, removeDataframe, removeFrame, reorderDataframes, reorderFrames, setActiveDataframeIndex, setActiveFrameIndex, setDataframeDropIndex, setDraggedDataframeIndex, setDraggedFrameIndex, setExpandedAxisColumns, setFrameDropIndex, setMoveFrameTargetDataframe, setTabRename, tabRename, toggleDataframeGeneration, toggleFrameGeneration }
  const sectionProps = { activeDataframe, activeDataframeIndex, activeFrame, addAxis, addGuideline, addLayer, addPlotLanguage, availableAxisColumns, availableDatasets: availableDatasets ?? [], availableSheets: activeImportedSource?.sheets ?? [], availableKeywordsByColumn, availableWhitelistKeywords, automaticDisplayAreaActive, customMaterialNames, expandedAxisColumns, expandedLayerKeywords, handlePlotLanguageKeyDown, handleSpreadsheetSelection, hoveredDuplicateGroup, hoveredRemoveGroup, importDatabase, importInProgress, importedDatabaseStatus: displayedImportedDatabaseStatus, includedLayerKeywords, layerNameOptions, materialColors: activeDataframe.materialColors, materialKeywordOptions, patchActiveDataframe, patchActiveFrame, plotLanguageDraft, removeAxis, setCustomMaterialNames, setExpandedAxisColumns, setExpandedLayerKeywords, setHoveredDuplicateGroup, setHoveredRemoveGroup, setPlotLanguageDraft, setShowGenerateColorsConfirm, updateAxis, updateGuideline, updateLanguages, uploadInputRef }
  const settingsContent = (
    <>
      <Field label={t('uiLanguage')} jsonPath="ui.language">
        <Select value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value as UILanguage)}>
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </Select>
      </Field>
      <Field label={t('uiTheme')} jsonPath="ui.theme">
        <Select value={uiTheme} onChange={(event) => setUiTheme(event.target.value as UIThemePreference)}>
          <option value="system">{t('themeSystem')}</option>
          <option value="light">{t('themeLight')}</option>
          <option value="dark">{t('themeDark')}</option>
        </Select>
      </Field>
      <Field label={t('localDataFiles')} jsonPath="ui.local_data_files">
        <Button type="button" variant="outline" onClick={() => { void clearStoredDatasourceFiles() }}>
          {t('deleteStoredFiles')}
        </Button>
      </Field>
    </>
  )
  return (
    <I18nContext.Provider value={i18n}>
    <div className="flex min-h-screen flex-col">
      <AppHeader {...headerProps} />
      {backendAvailable === false ? (
        <div className="mx-auto w-full px-5 pt-5">
          <Alert variant="warning">{t('backendUnavailable')}</Alert>
        </div>
      ) : null}
      {missingDatasourceDataframes.length > 0 ? (
        <div className="mx-auto w-full px-5 pt-5">
          <Alert variant="warning">
            {t('datasourceMissing', { list: missingDatasourceDataframes.map(({ dataframe, dataframeIndex }) => t('datasourceMissingItem', { n: dataframeIndex + 1, filename: dataframe.importFileName ?? '' })).join(', ') })}
          </Alert>
        </div>
      ) : null}
      {activePage === 'config' ? (
        <main className="grid min-h-0 w-full flex-1 grid-cols-1 gap-4 text-left">
          <ConfigTabs {...tabProps} />
          {alert ? (
            <Alert variant={alert.tone === 'success' ? 'success' : 'destructive'} className="flex items-center justify-between gap-3">
              <span>{alert.message}</span>
              <button type="button" className="rounded px-1 text-sm leading-none hover:bg-black/10 dark:hover:bg-white/10" onClick={() => setAlert(null)} aria-label={t('closeNotification')}>✕</button>
            </Alert>
          ) : null}
          <ConfigSections {...sectionProps}/>
        </main>
      ) : (
        <PlotPage plotConfig={plotConfig} configBaseName={configBaseName} activeDataframeIndex={activeDataframeIndex} activeFrameIndex={activeFrameIndex} plotAction={plotAction} plotActionNonce={plotActionNonce} datasourceFilesByDataframe={datasourceFilesByDataframe} availableDatasets={availableDatasets} />
      )}
      <AppPopouts
        showAbout={showAbout}
        showSettings={showSettings}
        showGenerateColorsConfirm={showGenerateColorsConfirm}
        showJson={showJson}
        showResetConfirm={showResetConfirm}
        datasourcePrompt={datasourcePrompt}
        jsonFullscreen={jsonFullscreen}
        jsonDraft={jsonDraft}
        jsonMarker={jsonMarker}
        settingsContent={settingsContent}
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
        onConfirmReset={resetConfig}
        onCloseDatasourcePrompt={closeDatasourcePrompt}
        onDatasourcePromptFile={handleDatasourcePromptFile}
        jsonOverlayRef={jsonOverlayRef}
        jsonTextareaRef={jsonTextareaRef}
      />
    </div>
    </I18nContext.Provider>
  )
}
export default App
