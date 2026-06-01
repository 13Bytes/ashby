import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { PlotPage } from './components/PlotPage'
import { Alert } from './components/ui/alert'
import { normalizePlotConfig } from './config/configMappers'
import { createDefaultPlotConfig, type PlotConfig } from './config/defaultPlotConfig'
import { parseImportedConfig, toExternalConfig } from './utils/configIo'
import { Select } from './components/ui/select'
import { UI_LABELS, type UILanguage } from './uiTranslations'
import { AppPopouts } from './components/AppPopouts'
import { addPlotLanguageToList, normalizePlotLanguages } from './utils/plotLanguages'
import { AppHeader } from './components/AppHeader'
import { ConfigSections } from './components/ConfigSections'
import { ConfigTabs } from './components/ConfigTabs'
import { Field } from './components/AppControls'
import { buildJsonFrameNeedle, getAxisBasesFromColumns, getConfigAxisColumns, getConfigLanguages, getConfigWhitelistKeywords, getSourceMode, numberValue, parseColumnsFromImportResult, WHITELIST_OPTIONS, type MultiOption, type SourceMode } from './utils/appState'
import { getJsonSyntaxMarkers, highlightJson } from './utils/jsonHighlight'
import { usePlotConfigActions } from './hooks/usePlotConfigActions'
import { applyUITheme, readStoredUITheme, subscribeToSystemTheme, UI_THEME_STORAGE_KEY, type UIThemePreference } from './utils/uiTheme'

type AppPage = 'config' | 'plot'
type AlertTone = 'success' | 'error'; interface AlertState { tone: AlertTone; message: string }
type PlotAction = 'preview-current' | 'create-all'

type ImportDatabaseResponse = { columns?: string[]; keywords_by_column?: Record<string, string[]>; import_file_name?: string; message?: string; success?: boolean }

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
  const [uiTheme, setUiTheme] = useState<UIThemePreference>(() => readStoredUITheme())
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
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null)
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
    const keywords = getConfigWhitelistKeywords(plotConfig)
    setAvailableWhitelistKeywords(keywords.map((entry) => ({ value: entry, label: entry })))
  }, [plotConfig])
  useEffect(() => {
    window.localStorage.setItem(UI_THEME_STORAGE_KEY, uiTheme)
    applyUITheme(uiTheme)
    if (uiTheme !== 'system') return
    return subscribeToSystemTheme((systemPrefersDark) => applyUITheme('system', document.documentElement, systemPrefersDark))
  }, [uiTheme])
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
  const plotConfigActions = usePlotConfigActions({ activeDataframe, activeDataframeIndex, activeFrameIndex, setActiveDataframeIndex, setActiveFrameIndex, setPlotConfig, setShowGenerateColorsConfirm })
  const { addAxis, addDataframe, addFrame, addGuideline, addLayer, duplicateDataframe, duplicateFrame, generateMaterialColors, moveFrameToDataframe, patchActiveDataframe, patchActiveFrame, patchDataframe, removeAxis, removeDataframe, removeFrame, reorderDataframes, reorderFrames, toggleDataframeGeneration, toggleFrameGeneration, updateAxis, updateGuideline } = plotConfigActions
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
  const jsonMarker = useMemo(() => getJsonSyntaxMarkers(jsonDraft), [jsonDraft])
  const jsonHighlightedHtml = useMemo(() => highlightJson(jsonDraft, jsonMarker), [jsonDraft, jsonMarker])
  const headerProps = { activePage, fileInputRef, handleImportFile, openJsonEditor, plotConfig, setActivePage, setPlotAction, setPlotActionNonce, setShowAbout, setShowMenu, setShowResetConfirm, setShowSettings, showMenu, t }
  const tabProps = { activeDataframe, activeDataframeIndex, activeFrameIndex, addDataframe, addFrame, applyTabRename, dataframeDropIndex, draggedDataframeIndex, draggedFrameIndex, duplicateDataframe, duplicateFrame, frameDropIndex, moveFrameTargetDataframe, moveFrameToDataframe, openTabWithSelection, plotConfig, removeDataframe, removeFrame, reorderDataframes, reorderFrames, setActiveDataframeIndex, setActiveFrameIndex, setDataframeDropIndex, setDraggedDataframeIndex, setDraggedFrameIndex, setExpandedAxisColumns, setFrameDropIndex, setMoveFrameTargetDataframe, setTabRename, tabRename, t, toggleDataframeGeneration, toggleFrameGeneration }
  const sectionProps = { activeDataframe, activeDataframeIndex, activeFrame, addAxis, addGuideline, addLayer, addPlotLanguage, availableAxisColumns, availableKeywordsByColumn, availableWhitelistKeywords, automaticDisplayAreaActive, customMaterialNames, expandedAxisColumns, expandedLayerKeywords, handlePlotLanguageKeyDown, handleSpreadsheetSelection, hoveredRemoveGroup, importDatabase, importInProgress, importedDatabaseStatus, layerNameOptions, materialColorOptions, materialKeywordOptions, numberValue, parseJsonField, patchActiveDataframe, patchActiveFrame, plotLanguageDraft, removeAxis, setCustomMaterialNames, setExpandedAxisColumns, setExpandedLayerKeywords, setHoveredRemoveGroup, setPlotLanguageDraft, setShowGenerateColorsConfirm, t, uiLanguage, updateAxis, updateGuideline, updateLanguages, uploadInputRef }
  const settingsContent = (
    <>
      <Field language={uiLanguage} label={t('uiLanguage')} jsonPath="ui.language">
        <Select value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value as UILanguage)}>
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </Select>
      </Field>
      <Field language={uiLanguage} label={t('uiTheme')} jsonPath="ui.theme">
        <Select value={uiTheme} onChange={(event) => setUiTheme(event.target.value as UIThemePreference)}>
          <option value="system">{t('themeSystem')}</option>
          <option value="light">{t('themeLight')}</option>
          <option value="dark">{t('themeDark')}</option>
        </Select>
      </Field>
    </>
  )
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader {...headerProps} />
      {backendAvailable === false ? (
        <div className="mx-auto w-full max-w-[1800px] px-5 pt-5">
          <Alert variant="warning">{t('backendUnavailable')}</Alert>
        </div>
      ) : null}
      {activePage === 'config' ? (
        <main className="mx-auto grid min-h-0 w-full max-w-[1800px] flex-1 grid-cols-1 gap-4 p-5 text-left">
          <ConfigTabs {...tabProps} />
          {alert ? (
            <Alert variant={alert.tone === 'success' ? 'success' : 'destructive'} className="flex items-center justify-between gap-3">
              <span>{alert.message}</span>
              <button type="button" className="rounded px-1 text-sm leading-none hover:bg-black/10 dark:hover:bg-white/10" onClick={() => setAlert(null)} aria-label="Close notification">✕</button>
            </Alert>
          ) : null}
          <ConfigSections {...sectionProps} />
        </main>
      ) : (
        <PlotPage plotConfig={plotConfig} configBaseName={configBaseName} activeDataframeIndex={activeDataframeIndex} activeFrameIndex={activeFrameIndex} plotAction={plotAction} plotActionNonce={plotActionNonce} />
      )}
      <AppPopouts
        showAbout={showAbout}
        showSettings={showSettings}
        showGenerateColorsConfirm={showGenerateColorsConfirm}
        showJson={showJson}
        showResetConfirm={showResetConfirm}
        jsonFullscreen={jsonFullscreen}
        jsonDraft={jsonDraft}
        jsonHighlightedHtml={jsonHighlightedHtml}
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
        onConfirmReset={() => { setPlotConfig(createDefaultPlotConfig()); setShowResetConfirm(false) }}
        t={t}
        jsonOverlayRef={jsonOverlayRef}
        jsonTextareaRef={jsonTextareaRef}
      />
    </div>
  )
}
export default App
