import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { PlotPage } from './components/PlotPage'
import { Alert } from './components/ui/alert'
import { Button } from './components/ui/button'
import { normalizePlotConfig } from './config/configMappers'
import { AXIS_MODES, PLOT_ALGORITHMS, createDefaultPlotConfig, type AxisConfig, type DataframeConfig, type FrameConfig, type PlotConfig } from './config/defaultPlotConfig'
import { exportConfig, parseImportedConfig } from './utils/configIo'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'

type AppPage = 'config' | 'plot'
type AlertTone = 'success' | 'error'
interface AlertState { tone: AlertTone; message: string }

const parseCsv = (value: string): string[] => value.split(',').map((entry) => entry.trim()).filter(Boolean)
const stringifyCsv = (values: string[] | undefined): string => values?.join(', ') ?? ''
const numberValue = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback)

function Field({ label, jsonPath, children }: { label: string; jsonPath: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <label title={jsonPath} className="font-medium text-zinc-900 dark:text-zinc-100">{label}</label>
      {children}
    </div>
  )
}

function App() {
  const [plotConfig, setPlotConfig] = useState<PlotConfig>(() => createDefaultPlotConfig())
  const [activePage, setActivePage] = useState<AppPage>('config')
  const [activeDataframeIndex, setActiveDataframeIndex] = useState(0)
  const [activeFrameIndex, setActiveFrameIndex] = useState(0)
  const [showJson, setShowJson] = useState(false)
  const [jsonDraft, setJsonDraft] = useState('')
  const [alert, setAlert] = useState<AlertState | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const activeDataframe = plotConfig.dataframes[activeDataframeIndex] ?? plotConfig.dataframes[0]
  const activeFrame = activeDataframe.frames[activeFrameIndex] ?? activeDataframe.frames[0]

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

  const addLayer = () => {
    patchActiveFrame((frame) => ({
      ...frame,
      layers: [...frame.layers, { name: `Layer ${frame.layers.length + 1}`, whitelistFlag: false, whitelist: [], alpha: 0.4, linewidth: 1.5 }],
    }))
  }

  const updateAxis = (axisIndex: number, patch: (axis: AxisConfig) => AxisConfig) => {
    patchActiveDataframe((df) => ({ ...df, axes: df.axes.map((axis, index) => (index === axisIndex ? patch(axis) : axis)) }))
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
            <Field label="Selected plot language" jsonPath="dataframes[i].language">
              <Select value={activeDataframe.language} onChange={(e) => patchActiveDataframe((c) => ({ ...c, language: e.target.value }))}>
                {activeDataframe.plotLanguages.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
              </Select>
            </Field>
            <Field label="API key" jsonPath="dataframes[i].apiKey"><Input value={activeDataframe.apiKey ?? ''} onChange={(e) => patchActiveDataframe((c) => ({ ...c, apiKey: e.target.value || undefined }))} /></Field>
            <Field label="Teable URL" jsonPath="dataframes[i].teableUrl"><Input value={activeDataframe.teableUrl ?? ''} onChange={(e) => patchActiveDataframe((c) => ({ ...c, teableUrl: e.target.value || undefined }))} /></Field>
            <Field label="Import filename" jsonPath="dataframes[i].importFileName"><Input value={activeDataframe.importFileName ?? ''} onChange={(e) => patchActiveDataframe((c) => ({ ...c, importFileName: e.target.value || undefined }))} /></Field>
            <Field label="Import sheet" jsonPath="dataframes[i].importSheet"><Input type="number" value={activeDataframe.importSheet} onChange={(e) => patchActiveDataframe((c) => ({ ...c, importSheet: numberValue(e.target.valueAsNumber, c.importSheet) }))} /></Field>
            <Field label="Plot languages (add comma-separated)" jsonPath="dataframes[i].plotLanguages">
              <Input value={activeDataframe.plotLanguages.join(', ')} onChange={(e) => updateLanguages(parseCsv(e.target.value))} />
            </Field>
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              {activeDataframe.plotLanguages.map((lang) => (
                <button key={lang} type="button" className={`rounded-full border px-3 py-1 text-xs ${activeDataframe.language === lang ? 'border-violet-500 bg-violet-100' : 'border-zinc-300'}`} onClick={() => patchActiveDataframe((c) => ({ ...c, language: lang }))}>
                  {lang} <span onClick={(event) => { event.stopPropagation(); updateLanguages(activeDataframe.plotLanguages.filter((entry) => entry !== lang)) }}>×</span>
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold">Frame</h3>
            <Field label="Frame name" jsonPath="dataframes[i].frames[j].name"><Input value={activeFrame.name ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, name: e.target.value || undefined }))} /></Field>
            <Field label="Export file name" jsonPath="dataframes[i].frames[j].export_file_name"><Input value={activeFrame.exportFileName ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, exportFileName: e.target.value || undefined }))} /></Field>
            <Field label="Algorithm" jsonPath="dataframes[i].frames[j].algorithm"><Select value={activeFrame.algorithm} onChange={(e) => patchActiveFrame((c) => ({ ...c, algorithm: e.target.value as FrameConfig['algorithm'] }))}>{PLOT_ALGORITHMS.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field>
            <Field label="Legend enabled" jsonPath="legendFlag"><Select value={activeFrame.legendFlag ? 'true' : 'false'} onChange={(e) => patchActiveFrame((c) => ({ ...c, legendFlag: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field>
            <Field label="X quantity" jsonPath="x_quantity"><Select value={activeFrame.xQuantity} onChange={(e) => patchActiveFrame((c) => ({ ...c, xQuantity: e.target.value }))}>{activeDataframe.axes.map((axis) => <option key={axis.name} value={axis.name}>{axis.name}</option>)}</Select></Field>
            <Field label="Y quantity" jsonPath="y_quantity"><Select value={activeFrame.yQuantity} onChange={(e) => patchActiveFrame((c) => ({ ...c, yQuantity: e.target.value }))}>{activeDataframe.axes.map((axis) => <option key={axis.name} value={axis.name}>{axis.name}</option>)}</Select></Field>
            <Field label="Relative X quantity" jsonPath="x_rel_quantity"><Input value={activeFrame.xRelQuantity ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, xRelQuantity: e.target.value || undefined }))} /></Field>
            <Field label="Relative Y quantity" jsonPath="y_rel_quantity"><Input value={activeFrame.yRelQuantity ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, yRelQuantity: e.target.value || undefined }))} /></Field>
            {activeDataframe.plotLanguages.map((lang) => (
              <Field key={lang} label={`Title (${lang})`} jsonPath={`title.${lang}`}><Input value={activeFrame.title[lang] ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, title: { ...c.title, [lang]: e.target.value } }))} /></Field>
            ))}
            {activeDataframe.plotLanguages.map((lang) => (
              <Field key={`legend-${lang}`} label={`Legend title (${lang})`} jsonPath={`legendTitle.${lang}`}><Input value={activeDataframe.legendTitle[lang] ?? ''} onChange={(e) => patchActiveDataframe((c) => ({ ...c, legendTitle: { ...c.legendTitle, [lang]: e.target.value } }))} /></Field>
            ))}
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">Axes</h3>
            {activeDataframe.axes.map((axis, axisIndex) => (
              <div key={`${axis.name}-${axisIndex}`} className="grid gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900 sm:grid-cols-2">
                <Field label={`Axis ${axisIndex + 1} Name`} jsonPath={`axes[${axisIndex}].name`}><Input value={axis.name} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, name: e.target.value }))} /></Field>
                <Field label={`Axis ${axisIndex + 1} Mode`} jsonPath={`axes[${axisIndex}].mode`}><Select value={axis.mode} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, mode: e.target.value as AxisConfig['mode'] }))}>{AXIS_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</Select></Field>
                <Field label={`Axis ${axisIndex + 1} Columns`} jsonPath={`axes[${axisIndex}].columns`}><Input value={stringifyCsv(axis.columns)} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, columns: parseCsv(e.target.value) }))} /></Field>
                {activeDataframe.plotLanguages.map((lang) => (
                  <Field key={`${axis.name}-${lang}`} label={`Axis ${axisIndex + 1} Label (${lang})`} jsonPath={`axes[${axisIndex}].labels.${lang}`}><Input value={axis.labels[lang] ?? ''} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, labels: { ...a.labels, [lang]: e.target.value } }))} /></Field>
                ))}
              </div>
            ))}
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2"><h3 className="text-sm font-semibold">Layers</h3><Button variant="outline" size="sm" onClick={addLayer}>+ Layer</Button></div>
            {activeFrame.layers.map((layer, layerIndex) => (
              <div key={layerIndex} className="grid gap-3 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700 sm:grid-cols-2">
                <Field label={`Layer ${layerIndex + 1} Name`} jsonPath={`layers[${layerIndex}].name`}><Input value={layer.name ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, name: e.target.value } : x) }))} /></Field>
                <Field label="Whitelist keywords" jsonPath={`layers[${layerIndex}].whitelist`}><Input value={stringifyCsv(layer.whitelist)} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, whitelist: parseCsv(e.target.value) } : x) }))} /></Field>
                <Field label="Alpha" jsonPath={`layers[${layerIndex}].alpha`}><Input type="number" step={0.05} min={0} max={1} value={layer.alpha ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, alpha: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : x) }))} /></Field>
                <Field label="Line width" jsonPath={`layers[${layerIndex}].linewidth`}><Input type="number" step={0.1} value={layer.linewidth ?? 1.5} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, linewidth: numberValue(e.target.valueAsNumber, x.linewidth ?? 1.5) } : x) }))} /></Field>
              </div>
            ))}
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold">Advanced JSON fields</h3>
            <Field label="Filter" jsonPath="filter"><textarea className="min-h-24 rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={JSON.stringify(activeFrame.filter ?? {}, null, 2)} onChange={(e) => patchActiveFrame((f) => ({ ...f, filter: parseJsonField<Record<string, unknown>>(e.target.value, f.filter ?? {}) }))} /></Field>
            <Field label="Guidelines" jsonPath="guidelines"><textarea className="min-h-24 rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={JSON.stringify(activeFrame.guidelines, null, 2)} onChange={(e) => patchActiveFrame((f) => ({ ...f, guidelines: parseJsonField(e.target.value, f.guidelines) }))} /></Field>
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

      <footer className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
        <input ref={fileInputRef} type="file" accept=".json,.jsonc,application/json" className="hidden" onChange={handleImportFile} />
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>Import</Button>
        <Button type="button" variant="outline" onClick={() => exportConfig(plotConfig)}>Export</Button>
        <Button type="button" onClick={() => setPlotConfig(createDefaultPlotConfig())}>Reset</Button>
      </footer>
    </div>
  )
}

export default App
