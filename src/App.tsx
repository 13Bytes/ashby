import { useMemo, useState } from 'react'
import type { PlotConfig } from './types/plotConfig'
import './App.css'

const tabLabels = [
  'General',
  'Data Source',
  'Axes',
  'Layers',
  'Styling',
  'Advanced',
] as const

type ConfigTab = (typeof tabLabels)[number]

const initialPlotConfig: PlotConfig = {
  version: 3,
  create_all_dataframes: true,
  dataframes: [
    {
      name: 'Default Dataframe',
      API_Key: null,
      teable_url: null,
      import_file_name: '',
      import_sheet: 0,
      image_ratio: 16 / 9,
      resolution: 'svg',
      legend_title: {
        en: 'Material Family',
      },
      font: {
        font_style: 'sans-serif',
        font: 'Arial',
        font_size: 22,
      },
      language: 'en',
      dark_mode: false,
      create_all_frames: true,
      frames: [
        {
          name: 'Frame 1',
          legend_flag: true,
          title: {
            en: 'New Ashby Plot',
          },
          dark_mode: false,
          legend_above: false,
          language: 'en',
          export_file_name: null,
          x_quantity: 'Density',
          x_rel_quantity: null,
          log_x_flag: true,
          x_lim: null,
          y_quantity: 'Youngs Modulus',
          y_rel_quantity: null,
          log_y_flag: true,
          y_lim: null,
          automatic_Display_Area_margin: 0.12,
          algorithm: 'cubic',
          layers: [
            {
              name: 'All Materials',
              whitelist_flag: true,
              whitelist: null,
              alpha: 0.35,
              linewidth: 1.5,
            },
            {
              alpha_points: null,
              alpha_areas: null,
            },
          ],
          filter: {},
          guidelines: [],
          annotations: [
            {
              marker_size: 330,
              font_size: 18,
            },
          ],
          colored_areas: [],
          highlighted_hulls: [],
        },
      ],
      axes: [
        {
          name: 'Density',
          columns: ['density'],
          mode: 'default',
          labels: {
            en: 'Density [kg/m³]',
          },
        },
        {
          name: 'Youngs Modulus',
          columns: ['youngs_modulus'],
          mode: 'default',
          labels: {
            en: "Young's Modulus [GPa]",
          },
        },
      ],
      material_colors: {
        default: '#000000',
      },
    },
  ],
}

function App() {
  const [plotConfig, setPlotConfig] = useState<PlotConfig>(initialPlotConfig)
  const [activeTab, setActiveTab] = useState<ConfigTab>('General')

  const activeDataframe = plotConfig.dataframes[0]
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
    setPlotConfig(initialPlotConfig)
    setActiveTab('General')
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
            <p>
              {activeTab} controls will live here. This panel is already wired to the
              top-level <code>plotConfig</code> state object.
            </p>
          </section>
        </aside>

        <section className="preview-panel">
          <h2>Preview</h2>
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
        <button type="button">Import Config</button>
        <button type="button">Export Config</button>
        <button type="button" onClick={resetConfig}>
          Reset
        </button>
      </footer>
    </div>
  )
}

export default App
