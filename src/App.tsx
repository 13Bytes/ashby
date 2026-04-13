import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { DataSourceSection } from './components/DataSourceSection'
import { Alert } from './components/ui/alert'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { normalizePlotConfig } from './config/configMappers'
import { createDefaultPlotConfig, type DataframeConfig, type PlotConfig } from './config/defaultPlotConfig'
import { exportConfig, parseImportedConfig } from './utils/configIo'
import { cn } from './lib/utils'

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
    setPlotConfig((current) => ({
      ...current,
      dataframes: current.dataframes.map((df, dfIndex) => (dfIndex === index ? patch(df) : df)),
    }))
  }

  const addDataframe = () => {
    setPlotConfig((current) => {
      const template = current.dataframes[activeDataframeIndex] ?? current.dataframes[0]
      const clone: DataframeConfig = {
        ...structuredClone(template),
        name: `Dataframe ${current.dataframes.length + 1}`,
      }

      return {
        ...current,
        createAllDataframes:
          current.createAllDataframes === true
            ? true
            : [...current.createAllDataframes, current.dataframes.length],
        dataframes: [...current.dataframes, clone],
      }
    })

    setActiveDataframeIndex((current) => current + 1)
    setAlert({ tone: 'success', message: 'Added dataframe.' })
  }

  const handleExport = () => {
    exportConfig(plotConfig)
    setAlert({ tone: 'success', message: 'Config exported as JSON.' })
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
      setAlert({ tone: 'error', message: 'Invalid config file. Please import valid JSON/JSONC.' })
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 p-6 text-left dark:border-zinc-800">
        <h1 className="m-0 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Ashby Plot Builder</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Build and validate your configuration from a single typed state tree.
        </p>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[320px_1fr]">
        <aside className="flex flex-col gap-4 border-b border-zinc-200 p-5 text-left md:border-r md:border-b-0 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Configuration</h2>
          <nav className="grid gap-2" aria-label="Configuration sections">
            {tabLabels.map((tab) => (
              <Button
                key={tab}
                type="button"
                variant="outline"
                className={cn(
                  'justify-start',
                  tab === activeTab && 'border-violet-400 bg-violet-100/70 dark:bg-violet-900/30',
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </Button>
            ))}
          </nav>
          <section className="rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700" aria-live="polite">
            <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">{activeTab}</h3>
            {activeTab === 'Data Source' ? (
              <DataSourceSection
                plotConfig={plotConfig}
                activeDataframeIndex={activeDataframeIndex}
                onPatchDataframe={patchDataframe}
                onAddDataframe={addDataframe}
              />
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {activeTab} controls will live here. This panel is already wired to the top-level{' '}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">plotConfig</code>{' '}
                state object.
              </p>
            )}
          </section>
        </aside>

        <section className="flex min-w-0 flex-col gap-4 p-5 text-left">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Preview</h2>
          {alert ? (
            <Alert variant={alert.tone === 'success' ? 'success' : 'destructive'}>{alert.message}</Alert>
          ) : null}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
            {summaryCards.map((card) => (
              <Card key={card.label}>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{card.label}</span>
                <strong className="text-zinc-900 dark:text-zinc-100">{card.value}</strong>
              </Card>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <h3 className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
              JSON Preview
            </h3>
            <pre className="max-h-[420px] overflow-auto bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
              {JSON.stringify(plotConfig, null, 2)}
            </pre>
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.jsonc,application/json"
          className="hidden"
          onChange={handleImportFile}
        />
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
          Import Config
        </Button>
        <Button type="button" variant="outline" onClick={handleExport}>
          Export Config
        </Button>
        <Button type="button" onClick={resetConfig}>
          Reset
        </Button>
      </footer>
    </div>
  )
}

export default App
