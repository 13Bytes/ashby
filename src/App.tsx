import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { DataSourceSection } from './components/DataSourceSection'
import { normalizePlotConfig } from './config/configMappers'
import { createDefaultPlotConfig, type DataframeConfig, type PlotConfig } from './config/defaultPlotConfig'
import { exportConfig, parseImportedConfig } from './utils/configIo'
import './App.css'

const tabLabels = ['General', 'Data Source', 'Axes', 'Layers', 'Styling', 'Advanced'] as const

type ConfigTab = (typeof tabLabels)[number]
type AlertTone = 'success' | 'error'

interface AlertState {
  tone: AlertTone
  message: string
}

function App() {
  const [plotConfig, setPlotConfig] = useState<PlotConfig>(() => createDefaultPlotConfig())
  const [activeTab, setActiveTab] = useState<ConfigTab>('General')
  const [activeDataframeIndex, setActiveDataframeIndex] = useState(0)
  const [alert, setAlert] = useState<AlertState | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const activeDataframe = plotConfig.dataframes[activeDataframeIndex] ?? plotConfig.dataframes[0]
  const activeFrame = activeDataframe.frames[0]

  const summaryCards = useMemo(
    () => [
      { label: 'Version', value: String(plotConfig.version) },
      { label: 'Dataframes', value: String(plotConfig.dataframes.length) },
      { label: 'Frames', value: String(activeDataframe.frames.length) },
      { label: 'Axes', value: String(activeDataframe.axes.length) },
      { label: 'Layers', value: String(activeFrame.layers.length) },
      { label: 'Language', value: activeDataframe.language || 'n/a' },
    ],
    [plotConfig, activeDataframe, activeFrame],
  )

  const resetConfig = () => {
    setPlotConfig(createDefaultPlotConfig())
    setActiveDataframeIndex(0)
    setActiveTab('General')
    setAlert({ tone: 'success', message: 'Configuration reset to defaults.' })
  }

  const patchDataframe = (index: number, patch: (current: DataframeConfig) => DataframeConfig) => {
    setPlotConfig((current) => {
      const nextFrames = current.dataframes.map((df, dfIndex) =>
        dfIndex === index ? patch(df) : df,
      )

      return {
        ...current,
        dataframes: nextFrames,
      }
    })
  }

  const addDataframe = () => {
    const template = plotConfig.dataframes[activeDataframeIndex] ?? plotConfig.dataframes[0]
    const clone: DataframeConfig = {
      ...structuredClone(template),
      name: `Dataframe ${plotConfig.dataframes.length + 1}`,
    }

    setPlotConfig((current) => ({
      ...current,
      createAllDataframes:
        current.createAllDataframes === true
          ? true
          : [...current.createAllDataframes, current.dataframes.length],
      dataframes: [...current.dataframes, clone],
    }))

    setActiveDataframeIndex(plotConfig.dataframes.length)
    setAlert({ tone: 'success', message: 'Added dataframe.' })
  }

  const handleExport = () => {
    exportConfig(plotConfig)
    setAlert({ tone: 'success', message: 'Config exported as JSON.' })
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = parseImportedConfig(text, true)
      const normalized = normalizePlotConfig(parsed)

      setPlotConfig(normalized)
      setActiveDataframeIndex(0)
      setAlert({ tone: 'success', message: `Imported ${file.name} successfully.` })
    } catch {
      setAlert({
        tone: 'error',
        message: 'Invalid config file. Please import valid JSON/JSONC.',
      })
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="plot-builder-page">
      <header className="app-header">
        <h1>Ashby Plot Builder</h1>
        <p>Build and validate your configuration from a single typed state tree.</p>
      </header>

      <main className="app-main">
        <aside className="config-panel">
          <h2>Configuration</h2>
          <nav className="tabs" aria-label="Configuration sections">
            {tabLabels.map((tab) => (
              <button
                key={tab}
                type="button"
                className={tab === activeTab ? 'tab is-active' : 'tab'}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </nav>
          <section className="tab-content" aria-live="polite">
            <h3>{activeTab}</h3>
            {activeTab === 'Data Source' ? (
              <DataSourceSection
                plotConfig={plotConfig}
                activeDataframeIndex={activeDataframeIndex}
                onPatchDataframe={patchDataframe}
                onAddDataframe={addDataframe}
              />
            ) : (
              <p>
                {activeTab} controls will live here. This panel is already wired to the
                top-level <code>plotConfig</code> state object.
              </p>
            )}
          </section>
        </aside>

        <section className="preview-panel">
          <h2>Preview</h2>
          {alert ? (
            <div className={alert.tone === 'success' ? 'alert alert-success' : 'alert alert-error'} role="status">
              {alert.message}
            </div>
          ) : null}
          <div className="summary-grid">
            {summaryCards.map((card) => (
              <article key={card.label} className="summary-card">
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
          </div>

          <div className="json-preview">
            <h3>JSON Preview</h3>
            <pre>{JSON.stringify(plotConfig, null, 2)}</pre>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.jsonc,application/json"
          className="hidden-input"
          onChange={handleImportFile}
        />
        <button type="button" onClick={handleImportClick}>
          Import Config
        </button>
        <button type="button" onClick={handleExport}>
          Export Config
        </button>
        <button type="button" onClick={resetConfig}>
          Reset
        </button>
      </footer>
    </div>
  )
}

export default App
