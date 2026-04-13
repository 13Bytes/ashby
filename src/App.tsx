import { useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import { PlotPage } from './components/PlotPage'
import { Alert } from './components/ui/alert'
import { Button } from './components/ui/button'
import { normalizePlotConfig } from './config/configMappers'
import { AXIS_MODES, PLOT_ALGORITHMS, createDefaultPlotConfig, type AxisConfig, type DataframeConfig, type FrameConfig, type GuidelineConfig, type PlotConfig } from './config/defaultPlotConfig'
import { exportConfig, parseImportedConfig } from './utils/configIo'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'

type AppPage = 'config' | 'plot'
type AlertTone = 'success' | 'error'
interface AlertState { tone: AlertTone; message: string }
type SourceMode = 'teable' | 'file'

type MultiOption = { value: string; label: string }

const AXIS_COLUMN_OPTIONS: MultiOption[] = [
  { value: 'Deflection Temperature at 18 MPa 264 psi', label: 'Deflection Temperature (18 MPa)' },
  { value: 'Tensile Strength Yield', label: 'Tensile Strength Yield' },
  { value: 'Tensile Strength Ultimate', label: 'Tensile Strength Ultimate' },
  { value: 'Density', label: 'Density' },
]

const WHITELIST_OPTIONS: MultiOption[] = [
  { value: 'ABS', label: 'ABS' },
  { value: 'PA12', label: 'PA12' },
  { value: 'PEEK', label: 'PEEK' },
  { value: 'PETG', label: 'PETG' },
]

const numberValue = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback)
const getSourceMode = (dataframe: DataframeConfig): SourceMode =>
  dataframe._extensions.sourceMode === 'teable' || dataframe._extensions.sourceMode === 'file'
    ? dataframe._extensions.sourceMode
    : dataframe.teableUrl || dataframe.apiKey
      ? 'teable'
      : 'file'

function Field({ label, jsonPath, children }: { label: string; jsonPath: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <label title={jsonPath} className="font-medium text-zinc-900 dark:text-zinc-100">{label}</label>
      {children}
    </div>
  )
}

function MultiSelectInput({ value, options, placeholder, onChange }: { value: string[]; options: MultiOption[]; placeholder: string; onChange: (next: string[]) => void }) {
  return (
    <div className="grid gap-2">
      <Select
        multiple
        value={value}
        className="min-h-24"
        onChange={(event) => {
          const selected = Array.from(event.currentTarget.selectedOptions).map((option) => option.value)
          onChange(selected)
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
      <p className="m-0 text-xs text-zinc-500">{placeholder}</p>
    </div>
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
  const [plotLanguageDraft, setPlotLanguageDraft] = useState('')
  const [uiLanguage, setUiLanguage] = useState<'en' | 'de'>('en')

  const activeDataframe = plotConfig.dataframes[activeDataframeIndex] ?? plotConfig.dataframes[0]
  const activeFrame = activeDataframe.frames[activeFrameIndex] ?? activeDataframe.frames[0]
  const sourceMode = getSourceMode(activeDataframe)

  const patchDataframe = (index: number, patch: (current: DataframeConfig) => DataframeConfig) => {
    setPlotConfig((current) => ({ ...current, dataframes: current.dataframes.map((df, i) => (i === index ? patch(df) : df)) }))
  }
  const patchActiveDataframe = (patch: (current: DataframeConfig) => DataframeConfig) => patchDataframe(activeDataframeIndex, patch)
  const patchActiveFrame = (patch: (current: FrameConfig) => FrameConfig) => {
    patchActiveDataframe((df) => ({ ...df, frames: df.frames.map((frame, i) => (i === activeFrameIndex ? patch(frame) : frame)) }))
  }

  const addDataframe = () => {
    setPlotConfig((current) => ({ ...current, dataframes: [...current.dataframes, structuredClone(current.dataframes[0])] }))
    setActiveDataframeIndex(plotConfig.dataframes.length)
    setActiveFrameIndex(0)
  }

  const addFrame = () => {
    patchActiveDataframe((df) => ({ ...df, frames: [...df.frames, structuredClone(df.frames[0])] }))
    setActiveFrameIndex(activeDataframe.frames.length)
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

  const updateLanguages = (next: string[]) => {
    const sanitized = [...new Set(next.map((entry) => entry.trim()).filter(Boolean))]
    patchActiveDataframe((df) => ({
      ...df,
      plotLanguages: sanitized.length > 0 ? sanitized : ['en'],
      language: sanitized.includes(df.language) ? df.language : (sanitized[0] ?? 'en'),
      legendTitle: sanitized.reduce<Record<string, string>>((acc, lang) => ({ ...acc, [lang]: df.legendTitle[lang] ?? '' }), {}),
      axes: df.axes.map((axis) => ({
        ...axis,
        labels: sanitized.reduce<Record<string, string>>((acc, lang) => ({ ...acc, [lang]: axis.labels[lang] ?? '' }), {}),
      })),
      frames: df.frames.map((frame) => ({
        ...frame,
        title: sanitized.reduce<Record<string, string>>((acc, lang) => ({ ...acc, [lang]: frame.title[lang] ?? '' }), {}),
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
      setPlotConfig(normalized)
      setAlert({ tone: 'success', message: `Imported ${file.name} successfully.` })
    } catch {
      setAlert({ tone: 'error', message: 'Invalid config file.' })
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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 p-6 text-left dark:border-zinc-800">
        <div>
          <h1 className="m-0 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Ashby Plot Builder</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">Human-readable editor with editable JSON popup.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setUiLanguage((current) => (current === 'en' ? 'de' : 'en'))}>{uiLanguage === 'en' ? 'DE' : 'EN'}</Button>
          <Button type="button" variant="outline" onClick={() => { setJsonDraft(JSON.stringify(plotConfig, null, 2)); setShowJson(true) }}>JSON</Button>
          <Button type="button" variant="outline" onClick={() => setActivePage(activePage === 'config' ? 'plot' : 'config')}>
            {activePage === 'config' ? 'Show Plot' : 'Show Config'}
          </Button>
        </div>
      </header>

      {activePage === 'config' ? (
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-5 text-left">
          <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Dataframe</span>
              {plotConfig.dataframes.map((df, index) => (
                <Button key={index} variant="outline" size="sm" onClick={() => { setActiveDataframeIndex(index); setActiveFrameIndex(0) }}>
                  {df.name || `Dataframe ${index + 1}`}
                </Button>
              ))}
              <Button size="sm" onClick={addDataframe}>+</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <span className="text-sm font-semibold">Frame</span>
              {activeDataframe.frames.map((frame, index) => (
                <Button key={index} variant="outline" size="sm" onClick={() => setActiveFrameIndex(index)}>
                  {frame.name || `Frame ${index + 1}`}
                </Button>
              ))}
              <Button size="sm" onClick={addFrame}>+</Button>
            </div>
          </section>

          {alert ? <Alert variant={alert.tone === 'success' ? 'success' : 'destructive'}>{alert.message}</Alert> : null}

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold">Global + Dataframe</h3>
            <Field label="Config version" jsonPath="version"><Input type="number" value={plotConfig.version} onChange={(e) => setPlotConfig((c) => ({ ...c, version: numberValue(e.target.valueAsNumber, c.version) }))} /></Field>
            <Field label="Create all dataframes" jsonPath="create_all_dataframes">
              <Select value={plotConfig.createAllDataframes === true ? 'all' : 'selected'} onChange={(e) => setPlotConfig((c) => ({ ...c, createAllDataframes: e.target.value === 'all' ? true : [activeDataframeIndex] }))}>
                <option value="all">All</option><option value="selected">Selected</option>
              </Select>
            </Field>
            <Field label="Dataframe name" jsonPath="dataframes[i].name"><Input value={activeDataframe.name ?? ''} onChange={(e) => patchActiveDataframe((c) => ({ ...c, name: e.target.value || undefined }))} /></Field>
            <Field label="Dataframe language" jsonPath="dataframes[i].language">
              <Select value={activeDataframe.language} onChange={(e) => patchActiveDataframe((c) => ({ ...c, language: e.target.value }))}>
                {activeDataframe.plotLanguages.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
              </Select>
            </Field>
            <Field label="Image ratio" jsonPath="dataframes[i].imageRatio"><Input type="number" step="0.01" value={activeDataframe.imageRatio} onChange={(e) => patchActiveDataframe((c) => ({ ...c, imageRatio: numberValue(e.target.valueAsNumber, c.imageRatio) }))} /></Field>
            <Field label="Resolution" jsonPath="dataframes[i].resolution"><Input value={String(activeDataframe.resolution)} onChange={(e) => patchActiveDataframe((c) => ({ ...c, resolution: e.target.value === 'svg' ? 'svg' : numberValue(Number(e.target.value), 1000) }))} /></Field>
            <Field label="Dataframe dark mode" jsonPath="dataframes[i].darkMode"><Select value={activeDataframe.darkMode ? 'true' : 'false'} onChange={(e) => patchActiveDataframe((c) => ({ ...c, darkMode: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
            <Field label="Create all frames" jsonPath="dataframes[i].createAllFrames"><Select value={activeDataframe.createAllFrames === true ? 'all' : 'selected'} onChange={(e) => patchActiveDataframe((c) => ({ ...c, createAllFrames: e.target.value === 'all' ? true : [activeFrameIndex] }))}><option value="all">All</option><option value="selected">Selected</option></Select></Field>
            <Field label="Font style" jsonPath="font.font_style"><Input value={activeDataframe.font.fontStyle} onChange={(e) => patchActiveDataframe((c) => ({ ...c, font: { ...c.font, fontStyle: e.target.value } }))} /></Field>
            <Field label="Font family" jsonPath="font.font"><Input value={activeDataframe.font.font} onChange={(e) => patchActiveDataframe((c) => ({ ...c, font: { ...c.font, font: e.target.value } }))} /></Field>
            <Field label="Font size" jsonPath="font.font_size"><Input type="number" value={activeDataframe.font.fontSize} onChange={(e) => patchActiveDataframe((c) => ({ ...c, font: { ...c.font, fontSize: numberValue(e.target.valueAsNumber, c.font.fontSize) } }))} /></Field>
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold">Data source + language set</h3>
            <Field label="Source mode" jsonPath="dataframes[i]._extensions.sourceMode">
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
            <Field label="Import sheet" jsonPath="dataframes[i].importSheet"><Input type="number" value={activeDataframe.importSheet} onChange={(e) => patchActiveDataframe((c) => ({ ...c, importSheet: numberValue(e.target.valueAsNumber, c.importSheet) }))} /></Field>
            {sourceMode === 'teable' ? (
              <>
                <Field label="API key" jsonPath="dataframes[i].apiKey"><Input value={activeDataframe.apiKey ?? ''} onChange={(e) => patchActiveDataframe((c) => ({ ...c, apiKey: e.target.value || undefined }))} /></Field>
                <Field label="Teable URL" jsonPath="dataframes[i].teableUrl"><Input value={activeDataframe.teableUrl ?? ''} onChange={(e) => patchActiveDataframe((c) => ({ ...c, teableUrl: e.target.value || undefined }))} /></Field>
              </>
            ) : (
              <Field label="Upload .xlsx" jsonPath="dataframes[i].importFileName">
                <div className="flex gap-2">
                  <Input value={activeDataframe.importFileName ?? ''} readOnly placeholder="No file selected" />
                  <Button type="button" variant="outline" onClick={() => uploadInputRef.current?.click()}>Upload</Button>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      patchActiveDataframe((c) => ({ ...c, importFileName: file?.name || undefined }))
                      event.target.value = ''
                    }}
                  />
                </div>
              </Field>
            )}
            <Field label="Plot languages" jsonPath="dataframes[i].plotLanguages">
              <div className="flex items-center gap-2">
                <Input
                  value={plotLanguageDraft}
                  placeholder="Add language and press comma"
                  onChange={(e) => setPlotLanguageDraft(e.target.value)}
                  onKeyDown={handlePlotLanguageKeyDown}
                />
                <Button type="button" variant="outline" onClick={() => addPlotLanguage(plotLanguageDraft)}>Add</Button>
              </div>
            </Field>
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

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold">Frame</h3>
            <Field label="Frame name" jsonPath="dataframes[i].frames[j].name"><Input value={activeFrame.name ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, name: e.target.value || undefined }))} /></Field>
            <Field label="Export file name" jsonPath="dataframes[i].frames[j].export_file_name"><Input value={activeFrame.exportFileName ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, exportFileName: e.target.value || undefined }))} /></Field>
            <Field label="Algorithm" jsonPath="dataframes[i].frames[j].algorithm"><Select value={activeFrame.algorithm} onChange={(e) => patchActiveFrame((c) => ({ ...c, algorithm: e.target.value as FrameConfig['algorithm'] }))}>{PLOT_ALGORITHMS.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field>
            <Field label="Legend enabled" jsonPath="legend_flag"><Select value={activeFrame.legendFlag ? 'true' : 'false'} onChange={(e) => patchActiveFrame((c) => ({ ...c, legendFlag: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
            <Field label="Legend above" jsonPath="legend_above"><Select value={activeFrame.legendAbove ? 'true' : 'false'} onChange={(e) => patchActiveFrame((c) => ({ ...c, legendAbove: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
            <Field label="Frame language" jsonPath="language"><Select value={activeFrame.language} onChange={(e) => patchActiveFrame((c) => ({ ...c, language: e.target.value }))}>{activeDataframe.plotLanguages.map((lang) => <option key={`frame-${lang}`} value={lang}>{lang}</option>)}</Select></Field>
            <Field label="Frame dark mode" jsonPath="dark_mode"><Select value={activeFrame.darkMode ? 'true' : 'false'} onChange={(e) => patchActiveFrame((c) => ({ ...c, darkMode: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
            <Field label="X quantity" jsonPath="x_quantity"><Select value={activeFrame.xQuantity} onChange={(e) => patchActiveFrame((c) => ({ ...c, xQuantity: e.target.value }))}>{activeDataframe.axes.map((axis) => <option key={axis.name} value={axis.name}>{axis.name}</option>)}</Select></Field>
            <Field label="Y quantity" jsonPath="y_quantity"><Select value={activeFrame.yQuantity} onChange={(e) => patchActiveFrame((c) => ({ ...c, yQuantity: e.target.value }))}>{activeDataframe.axes.map((axis) => <option key={axis.name} value={axis.name}>{axis.name}</option>)}</Select></Field>
            <Field label="Relative X quantity" jsonPath="x_rel_quantity"><Input value={activeFrame.xRelQuantity ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, xRelQuantity: e.target.value || undefined }))} /></Field>
            <Field label="Relative Y quantity" jsonPath="y_rel_quantity"><Input value={activeFrame.yRelQuantity ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, yRelQuantity: e.target.value || undefined }))} /></Field>
            <Field label="Log X" jsonPath="log_x_flag"><Select value={activeFrame.logXFlag ? 'true' : 'false'} onChange={(e) => patchActiveFrame((c) => ({ ...c, logXFlag: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
            <Field label="Log Y" jsonPath="log_y_flag"><Select value={activeFrame.logYFlag ? 'true' : 'false'} onChange={(e) => patchActiveFrame((c) => ({ ...c, logYFlag: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
            <Field label="X limits (json)" jsonPath="x_lim"><Input value={JSON.stringify(activeFrame.xLim ?? null)} onChange={(e) => patchActiveFrame((c) => ({ ...c, xLim: parseJsonField<[number, number] | undefined>(e.target.value, c.xLim) }))} /></Field>
            <Field label="Y limits (json)" jsonPath="y_lim"><Input value={JSON.stringify(activeFrame.yLim ?? null)} onChange={(e) => patchActiveFrame((c) => ({ ...c, yLim: parseJsonField<[number, number] | undefined>(e.target.value, c.yLim) }))} /></Field>
            <Field label="Automatic display area margin" jsonPath="automatic_Display_Area_margin"><Input type="number" step="0.01" value={activeFrame.automaticDisplayAreaMargin} onChange={(e) => patchActiveFrame((c) => ({ ...c, automaticDisplayAreaMargin: numberValue(e.target.valueAsNumber, c.automaticDisplayAreaMargin) }))} /></Field>
            <Field key={uiLanguage} label={`Title (${uiLanguage})`} jsonPath={`title.${uiLanguage}`}><Input value={activeFrame.title[uiLanguage] ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, title: { ...c.title, [uiLanguage]: e.target.value } }))} /></Field>
            <Field key={`legend-${uiLanguage}`} label={`Legend title (${uiLanguage})`} jsonPath={`legendTitle.${uiLanguage}`}><Input value={activeDataframe.legendTitle[uiLanguage] ?? ''} onChange={(e) => patchActiveDataframe((c) => ({ ...c, legendTitle: { ...c.legendTitle, [uiLanguage]: e.target.value } }))} /></Field>
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Axes</h3>
              <Button variant="outline" size="sm" onClick={addAxis}>+ Axes</Button>
            </div>
            {activeDataframe.axes.map((axis, axisIndex) => (
              <div key={`${axis.name}-${axisIndex}`} className="grid gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900 sm:grid-cols-2">
                <Field label={`Axis ${axisIndex + 1} Name`} jsonPath={`axes[${axisIndex}].name`}><Input value={axis.name} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, name: e.target.value }))} /></Field>
                <Field label={`Axis ${axisIndex + 1} Mode`} jsonPath={`axes[${axisIndex}].mode`}><Select value={axis.mode} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, mode: e.target.value as AxisConfig['mode'] }))}>{AXIS_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</Select></Field>
                <Field label={`Axis ${axisIndex + 1} Columns`} jsonPath={`axes[${axisIndex}].columns`}>
                  <MultiSelectInput value={axis.columns} options={AXIS_COLUMN_OPTIONS} placeholder="Placeholder options for axis columns." onChange={(next) => updateAxis(axisIndex, (a) => ({ ...a, columns: next }))} />
                </Field>
                <Field key={`${axis.name}-${uiLanguage}`} label={`Axis ${axisIndex + 1} Label (${uiLanguage})`} jsonPath={`axes[${axisIndex}].labels.${uiLanguage}`}><Input value={axis.labels[uiLanguage] ?? ''} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, labels: { ...a.labels, [uiLanguage]: e.target.value } }))} /></Field>
              </div>
            ))}
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2"><h3 className="text-sm font-semibold">Layers</h3><Button variant="outline" size="sm" onClick={addLayer}>+ Layer</Button></div>
            {activeFrame.layers.map((layer, layerIndex) => (
              <div key={layerIndex} className="grid gap-3 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700 sm:grid-cols-2">
                <Field label={`Layer ${layerIndex + 1} Name`} jsonPath={`layers[${layerIndex}].name`}><Input value={layer.name ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, name: e.target.value } : x) }))} /></Field>
                <Field label="Whitelist mode" jsonPath={`layers[${layerIndex}].whitelist_flag`}><Select value={layer.whitelistFlag ? 'true' : 'false'} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, whitelistFlag: e.target.value === 'true' } : x) }))}><option value="true">Whitelist</option><option value="false">Blacklist</option></Select></Field>
                <Field label="Whitelist keywords" jsonPath={`layers[${layerIndex}].whitelist`}><MultiSelectInput value={layer.whitelist ?? []} options={WHITELIST_OPTIONS} placeholder="Placeholder keywords for now." onChange={(next) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, whitelist: next } : x) }))} /></Field>
                <Field label="Alpha" jsonPath={`layers[${layerIndex}].alpha`}><Input type="number" step={0.05} min={0} max={1} value={layer.alpha ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, alpha: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : x) }))} /></Field>
                <Field label="Line width" jsonPath={`layers[${layerIndex}].linewidth`}><Input type="number" min={0} step={0.1} value={layer.linewidth ?? 1.5} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, linewidth: Math.max(0, numberValue(e.target.valueAsNumber, x.linewidth ?? 1.5)) } : x) }))} /></Field>
                <Field label="Alpha points" jsonPath={`layers[${layerIndex}].alpha_points`}><Input type="number" step={0.05} min={0} max={1} value={layer.alphaPoints ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, alphaPoints: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : x) }))} /></Field>
                <Field label="Alpha areas" jsonPath={`layers[${layerIndex}].alpha_areas`}><Input type="number" step={0.05} min={0} max={1} value={layer.alphaAreas ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, alphaAreas: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : x) }))} /></Field>
              </div>
            ))}
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2"><h3 className="text-sm font-semibold">Guidelines</h3><Button variant="outline" size="sm" onClick={addGuideline}>+ Guideline</Button></div>
            {activeFrame.guidelines.map((guideline, index) => (
              <div key={index} className="grid gap-3 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700 sm:grid-cols-2">
                <Field label="x" jsonPath={`guidelines[${index}].x`}><Input type="number" value={guideline.x ?? ''} onChange={(e) => updateGuideline(index, (g) => ({ ...g, x: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} /></Field>
                <Field label="y" jsonPath={`guidelines[${index}].y`}><Input type="number" value={guideline.y ?? ''} onChange={(e) => updateGuideline(index, (g) => ({ ...g, y: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} /></Field>
                <Field label="m" jsonPath={`guidelines[${index}].m`}><Input type="number" value={guideline.m} onChange={(e) => updateGuideline(index, (g) => ({ ...g, m: numberValue(e.target.valueAsNumber, g.m) }))} /></Field>
                <Field label="line_props.linestyle" jsonPath={`guidelines[${index}].line_props.linestyle`}><Input value={guideline.lineProps.linestyle} onChange={(e) => updateGuideline(index, (g) => ({ ...g, lineProps: { ...g.lineProps, linestyle: e.target.value } }))} /></Field>
                <Field label="line_props.color" jsonPath={`guidelines[${index}].line_props.color`}><Input value={guideline.lineProps.color} onChange={(e) => updateGuideline(index, (g) => ({ ...g, lineProps: { ...g.lineProps, color: e.target.value } }))} /></Field>
                <Field label="line_props.linewidth" jsonPath={`guidelines[${index}].line_props.linewidth`}><Input type="number" value={guideline.lineProps.linewidth} onChange={(e) => updateGuideline(index, (g) => ({ ...g, lineProps: { ...g.lineProps, linewidth: numberValue(e.target.valueAsNumber, g.lineProps.linewidth) } }))} /></Field>
                <Field label="fontsize" jsonPath={`guidelines[${index}].fontsize`}><Input type="number" value={guideline.fontsize} onChange={(e) => updateGuideline(index, (g) => ({ ...g, fontsize: numberValue(e.target.valueAsNumber, g.fontsize) }))} /></Field>
                <Field label="font_color" jsonPath={`guidelines[${index}].font_color`}><Input value={guideline.fontColor} onChange={(e) => updateGuideline(index, (g) => ({ ...g, fontColor: e.target.value }))} /></Field>
                <Field label="label" jsonPath={`guidelines[${index}].label`}><Input value={guideline.label} onChange={(e) => updateGuideline(index, (g) => ({ ...g, label: e.target.value }))} /></Field>
                <Field label="label_above" jsonPath={`guidelines[${index}].label_above`}><Select value={guideline.labelAbove ? 'true' : 'false'} onChange={(e) => updateGuideline(index, (g) => ({ ...g, labelAbove: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
                <Field label="label_padding" jsonPath={`guidelines[${index}].label_padding`}><Input type="number" value={guideline.labelPadding} onChange={(e) => updateGuideline(index, (g) => ({ ...g, labelPadding: numberValue(e.target.valueAsNumber, g.labelPadding) }))} /></Field>
              </div>
            ))}
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold">Material colors</h3>
            {Object.entries(activeDataframe.materialColors).map(([material, color]) => (
              <div key={material} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                <Input value={material} readOnly />
                <Input type="color" value={color} className="h-10 w-16 p-1" onChange={(e) => patchActiveDataframe((df) => ({ ...df, materialColors: { ...df.materialColors, [material]: e.target.value } }))} />
                <Input value={color} onChange={(e) => patchActiveDataframe((df) => ({ ...df, materialColors: { ...df.materialColors, [material]: e.target.value } }))} />
              </div>
            ))}
            <Field label="Add color key" jsonPath="material_colors">
              <Button type="button" variant="outline" onClick={() => patchActiveDataframe((df) => ({ ...df, materialColors: { ...df.materialColors, ['new_material']: '#000000' } }))}>Add material color</Button>
            </Field>
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold">Advanced JSON fields</h3>
            <Field label="Filter" jsonPath="filter"><textarea className="min-h-24 rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={JSON.stringify(activeFrame.filter ?? {}, null, 2)} onChange={(e) => patchActiveFrame((f) => ({ ...f, filter: parseJsonField<Record<string, unknown>>(e.target.value, f.filter ?? {}) }))} /></Field>
            <Field label="Annotations" jsonPath="annotations"><textarea className="min-h-24 rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={JSON.stringify(activeFrame.annotations, null, 2)} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: parseJsonField(e.target.value, f.annotations) }))} /></Field>
            <Field label="Colored areas" jsonPath="coloredAreas"><textarea className="min-h-24 rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={JSON.stringify(activeFrame.coloredAreas, null, 2)} onChange={(e) => patchActiveFrame((f) => ({ ...f, coloredAreas: parseJsonField(e.target.value, f.coloredAreas) }))} /></Field>
            <Field label="Highlighted hulls" jsonPath="highlightedHulls"><textarea className="min-h-24 rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={JSON.stringify(activeFrame.highlightedHulls, null, 2)} onChange={(e) => patchActiveFrame((f) => ({ ...f, highlightedHulls: parseJsonField(e.target.value, f.highlightedHulls) }))} /></Field>
          </section>
        </main>
      ) : (
        <PlotPage plotConfig={plotConfig} activeDataframeIndex={activeDataframeIndex} activeFrameIndex={activeFrameIndex} />
      )}

      {showJson ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-lg border border-zinc-700 bg-white dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
              <h3 className="text-sm font-semibold">JSON Editor</h3>
              <Button variant="outline" size="sm" onClick={() => setShowJson(false)}>Close</Button>
            </div>
            <textarea className="h-[70vh] w-full resize-none bg-zinc-50 p-3 font-mono text-xs dark:bg-zinc-900" value={jsonDraft} onChange={(e) => setJsonDraft(e.target.value)} />
            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              <Button size="sm" onClick={() => {
                try {
                  setPlotConfig(normalizePlotConfig(parseImportedConfig(jsonDraft, true)))
                  setAlert({ tone: 'success', message: 'JSON applied.' })
                  setShowJson(false)
                } catch {
                  setAlert({ tone: 'error', message: 'Invalid JSON in popup editor.' })
                }
              }}>Apply JSON</Button>
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

      <footer className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
        <input ref={fileInputRef} type="file" accept=".json,.jsonc,application/json" className="hidden" onChange={handleImportFile} />
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>Import</Button>
        <Button type="button" variant="outline" onClick={() => exportConfig(plotConfig)}>Export</Button>
        <Button type="button" onClick={() => setShowResetConfirm(true)}>Reset</Button>
      </footer>
    </div>
  )
}

export default App
