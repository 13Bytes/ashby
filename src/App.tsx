import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { PlotPage } from './components/PlotPage'
import { Alert } from './components/ui/alert'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { normalizePlotConfig } from './config/configMappers'
import { AXIS_MODES, PLOT_ALGORITHMS, createDefaultPlotConfig, type AxisConfig, type DataframeConfig, type FrameConfig, type PlotConfig } from './config/defaultPlotConfig'
import { exportConfig, parseImportedConfig } from './utils/configIo'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'

type AppPage = 'config' | 'plot'
type Locale = 'en' | 'de'

type AlertTone = 'success' | 'error'
interface AlertState { tone: AlertTone; message: string }

const parseCsv = (value: string): string[] => value.split(',').map((entry) => entry.trim()).filter(Boolean)
const stringifyCsv = (values: string[] | undefined): string => values?.join(', ') ?? ''
const numberValue = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback)

const labels = {
  en: {
    dataframe: 'Dataframe',
    frame: 'Frame',
    configVersion: 'Config version',
    createAllDataframes: 'Create all dataframes',
    dataframeName: 'Dataframe name',
    dataframeLanguage: 'Dataframe language',
    frameName: 'Frame name',
    exportFileName: 'Export file name',
    algorithm: 'Algorithm',
    xQuantity: 'X Axis quantity',
    yQuantity: 'Y Axis quantity',
    xRelQuantity: 'Relative X quantity',
    yRelQuantity: 'Relative Y quantity',
    layerName: 'Layer name',
    whitelist: 'Whitelist keywords',
    color: 'Color',
  },
  de: {
    dataframe: 'Datenrahmen',
    frame: 'Rahmen',
    configVersion: 'Konfigurationsversion',
    createAllDataframes: 'Alle Datenrahmen erstellen',
    dataframeName: 'Name Datenrahmen',
    dataframeLanguage: 'Sprache Datenrahmen',
    frameName: 'Name Rahmen',
    exportFileName: 'Export-Dateiname',
    algorithm: 'Algorithmus',
    xQuantity: 'X-Achsenwert',
    yQuantity: 'Y-Achsenwert',
    xRelQuantity: 'Relativer X-Wert',
    yRelQuantity: 'Relativer Y-Wert',
    layerName: 'Layer-Name',
    whitelist: 'Whitelist Stichwörter',
    color: 'Farbe',
  },
}

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
  const [activeLayerIndex, setActiveLayerIndex] = useState(0)
  const [showJson, setShowJson] = useState(false)
  const [locale, setLocale] = useState<Locale>('en')
  const [alert, setAlert] = useState<AlertState | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const t = labels[locale]
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
    setActiveLayerIndex(0)
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

  const summaryCards = useMemo(() => [
    { label: 'Version', value: String(plotConfig.version) },
    { label: 'Dataframes', value: String(plotConfig.dataframes.length) },
    { label: 'Frames', value: String(activeDataframe.frames.length) },
    { label: 'Axes', value: String(activeDataframe.axes.length) },
    { label: 'Layers', value: String(activeFrame.layers.length) },
  ], [plotConfig, activeDataframe, activeFrame])

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

  const layer = activeFrame.layers[activeLayerIndex] ?? activeFrame.layers[0]

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 p-6 text-left dark:border-zinc-800">
        <div>
          <h1 className="m-0 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Ashby Plot Builder</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">Human-readable editor with optional JSON popup.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setLocale(locale === 'en' ? 'de' : 'en')}>{locale === 'en' ? 'DE' : 'EN'}</Button>
          <Button type="button" variant="outline" onClick={() => setShowJson(true)}>JSON</Button>
          <Button type="button" variant="outline" onClick={() => setActivePage(activePage === 'config' ? 'plot' : 'config')}>
            {activePage === 'config' ? 'Show Plot' : 'Show Config'}
          </Button>
        </div>
      </header>

      {activePage === 'config' ? (
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-5 text-left">
          <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{t.dataframe}</span>
              {plotConfig.dataframes.map((df, index) => (
                <Button key={index} variant="outline" size="sm" onClick={() => { setActiveDataframeIndex(index); setActiveFrameIndex(0) }}>
                  {df.name || `Dataframe ${index + 1}`}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={addDataframe}>+ Dataframe</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <span className="text-sm font-semibold">{t.frame}</span>
              {activeDataframe.frames.map((frame, index) => (
                <Button key={index} variant="outline" size="sm" onClick={() => { setActiveFrameIndex(index); setActiveLayerIndex(0) }}>
                  {frame.name || `Frame ${index + 1}`}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={addFrame}>+ Frame</Button>
            </div>
          </section>

          {alert ? <Alert variant={alert.tone === 'success' ? 'success' : 'destructive'}>{alert.message}</Alert> : null}

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2">
            <Field label={t.configVersion} jsonPath="version"><Input type="number" value={plotConfig.version} onChange={(e) => setPlotConfig((c) => ({ ...c, version: numberValue(e.target.valueAsNumber, c.version) }))} /></Field>
            <Field label={t.createAllDataframes} jsonPath="create_all_dataframes">
              <Select value={plotConfig.createAllDataframes === true ? 'all' : 'selected'} onChange={(e) => setPlotConfig((c) => ({ ...c, createAllDataframes: e.target.value === 'all' ? true : [activeDataframeIndex] }))}>
                <option value="all">All</option><option value="selected">Selected</option>
              </Select>
            </Field>
            <Field label={t.dataframeName} jsonPath="dataframes[i].name"><Input value={activeDataframe.name ?? ''} onChange={(e) => patchActiveDataframe((c) => ({ ...c, name: e.target.value }))} /></Field>
            <Field label={t.dataframeLanguage} jsonPath="dataframes[i].language"><Input value={activeDataframe.language} onChange={(e) => patchActiveDataframe((c) => ({ ...c, language: e.target.value }))} /></Field>
            <Field label={t.frameName} jsonPath="dataframes[i].frames[j].name"><Input value={activeFrame.name ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, name: e.target.value }))} /></Field>
            <Field label={t.exportFileName} jsonPath="dataframes[i].frames[j].export_file_name"><Input value={activeFrame.exportFileName ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, exportFileName: e.target.value }))} /></Field>
            <Field label={t.algorithm} jsonPath="dataframes[i].frames[j].algorithm"><Select value={activeFrame.algorithm} onChange={(e) => patchActiveFrame((c) => ({ ...c, algorithm: e.target.value as FrameConfig['algorithm'] }))}>{PLOT_ALGORITHMS.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field>
            <Field label="Title (EN)" jsonPath="dataframes[i].frames[j].title.en"><Input value={activeFrame.title.en ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, title: { ...c.title, en: e.target.value } }))} /></Field>
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2">
            <Field label={t.xQuantity} jsonPath="x_quantity"><Select value={activeFrame.xQuantity} onChange={(e) => patchActiveFrame((c) => ({ ...c, xQuantity: e.target.value }))}>{activeDataframe.axes.map((axis) => <option key={axis.name} value={axis.name}>{axis.name}</option>)}</Select></Field>
            <Field label={t.yQuantity} jsonPath="y_quantity"><Select value={activeFrame.yQuantity} onChange={(e) => patchActiveFrame((c) => ({ ...c, yQuantity: e.target.value }))}>{activeDataframe.axes.map((axis) => <option key={axis.name} value={axis.name}>{axis.name}</option>)}</Select></Field>
            <Field label={t.xRelQuantity} jsonPath="x_rel_quantity"><Input value={activeFrame.xRelQuantity ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, xRelQuantity: e.target.value }))} /></Field>
            <Field label={t.yRelQuantity} jsonPath="y_rel_quantity"><Input value={activeFrame.yRelQuantity ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, yRelQuantity: e.target.value }))} /></Field>
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">Axes</h3>
            {activeDataframe.axes.map((axis, axisIndex) => (
              <div key={`${axis.name}-${axisIndex}`} className="grid gap-2 border-t border-zinc-200 pt-2 first:border-0 first:pt-0 sm:grid-cols-2">
                <Field label={`Axis ${axisIndex + 1} Name`} jsonPath={`axes[${axisIndex}].name`}><Input value={axis.name} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, name: e.target.value }))} /></Field>
                <Field label={`Axis ${axisIndex + 1} Mode`} jsonPath={`axes[${axisIndex}].mode`}><Select value={axis.mode} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, mode: e.target.value as AxisConfig['mode'] }))}>{AXIS_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</Select></Field>
                <Field label={`Axis ${axisIndex + 1} Columns`} jsonPath={`axes[${axisIndex}].columns`}><Input value={stringifyCsv(axis.columns)} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, columns: parseCsv(e.target.value) }))} /></Field>
                <Field label={`Axis ${axisIndex + 1} Label (DE)`} jsonPath={`axes[${axisIndex}].labels.de`}><Input value={axis.labels.de ?? ''} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, labels: { ...a.labels, de: e.target.value } }))} /></Field>
              </div>
            ))}
          </section>

          <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Layers</h3>
              <Select value={activeLayerIndex} onChange={(e) => setActiveLayerIndex(Number(e.target.value))}>{activeFrame.layers.map((entry, index) => <option key={index} value={index}>{entry.name || `Layer ${index + 1}`}</option>)}</Select>
              <Button variant="outline" size="sm" onClick={addLayer}>+ Layer</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`${locale === 'de' ? 'Layer' : 'Layer'} ${activeLayerIndex + 1} ${locale === 'de' ? 'Name' : 'Name'}`} jsonPath={`layers[${activeLayerIndex}].name`}><Input value={layer?.name ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === activeLayerIndex ? { ...x, name: e.target.value } : x) }))} /></Field>
              <Field label={t.whitelist} jsonPath={`layers[${activeLayerIndex}].whitelist`}><Input value={stringifyCsv(layer?.whitelist)} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === activeLayerIndex ? { ...x, whitelist: parseCsv(e.target.value) } : x) }))} /></Field>
              <Field label="Alpha" jsonPath={`layers[${activeLayerIndex}].alpha`}><Input type="number" step={0.05} min={0} max={1} value={layer?.alpha ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === activeLayerIndex ? { ...x, alpha: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : x) }))} /></Field>
              <Field label="Line width" jsonPath={`layers[${activeLayerIndex}].linewidth`}><Input type="number" step={0.1} value={layer?.linewidth ?? 1.5} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === activeLayerIndex ? { ...x, linewidth: numberValue(e.target.valueAsNumber, x.linewidth ?? 1.5) } : x) }))} /></Field>
            </div>
          </section>
        </main>
      ) : (
        <PlotPage plotConfig={plotConfig} activeDataframeIndex={activeDataframeIndex} activeFrameIndex={activeFrameIndex} />
      )}

      {showJson ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-lg border border-zinc-700 bg-white dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
              <h3 className="text-sm font-semibold">JSON Preview</h3>
              <Button variant="outline" size="sm" onClick={() => setShowJson(false)}>Close</Button>
            </div>
            <pre className="max-h-[75vh] overflow-auto bg-zinc-50 p-3 text-xs dark:bg-zinc-900">{JSON.stringify(plotConfig, null, 2)}</pre>
          </div>
        </div>
      ) : null}

      <footer className="flex flex-wrap justify-between gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
          {summaryCards.map((card) => <Card key={card.label}><span className="text-xs text-zinc-500 dark:text-zinc-400">{card.label}</span><strong className="text-zinc-900 dark:text-zinc-100">{card.value}</strong></Card>)}
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".json,.jsonc,application/json" className="hidden" onChange={handleImportFile} />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>Import</Button>
          <Button type="button" variant="outline" onClick={() => exportConfig(plotConfig)}>Export</Button>
          <Button type="button" onClick={() => setPlotConfig(createDefaultPlotConfig())}>Reset</Button>
        </div>
      </footer>
    </div>
  )
}

export default App
