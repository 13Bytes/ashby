import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { DataSourceSection } from './components/DataSourceSection'
import { Alert } from './components/ui/alert'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { normalizePlotConfig } from './config/configMappers'
import {
  AXIS_MODES,
  PLOT_ALGORITHMS,
  createDefaultPlotConfig,
  type AxisConfig,
  type DataframeConfig,
  type FrameConfig,
  type LayerConfig,
  type PlotConfig,
} from './config/defaultPlotConfig'
import { exportConfig, parseImportedConfig } from './utils/configIo'
import { cn } from './lib/utils'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'

const tabLabels = ['General', 'Data Source', 'Axes', 'Layers', 'Styling', 'Advanced'] as const

type ConfigTab = (typeof tabLabels)[number]
type AlertTone = 'success' | 'error'

interface AlertState {
  tone: AlertTone
  message: string
}

const inputClassName =
  'flex min-h-24 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400 dark:border-zinc-700'

const parseCsv = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

const stringifyCsv = (values: (string | null)[] | null | undefined): string =>
  values?.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0).join(', ') ?? ''

const numberValue = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback)

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={htmlFor} className="font-medium text-zinc-900 dark:text-zinc-100">
        {label}
      </label>
      {children}
      {hint ? <small className="text-xs text-zinc-600 dark:text-zinc-400">{hint}</small> : null}
    </div>
  )
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-zinc-300 accent-violet-600 dark:border-zinc-700"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}

function JsonEditor({
  label,
  value,
  onCommit,
}: {
  label: string
  value: unknown
  onCommit: (value: unknown) => void
}) {
  const [draft, setDraft] = useState(() => JSON.stringify(value, null, 2))
  const [error, setError] = useState<string | null>(null)

  const commit = () => {
    try {
      onCommit(JSON.parse(draft))
      setError(null)
    } catch {
      setError('Invalid JSON. Fix it before this value can be applied.')
    }
  }

  return (
    <Field label={label}>
      <textarea
        className={inputClassName}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        spellCheck={false}
      />
      {error ? <small className="text-xs text-red-600 dark:text-red-400">{error}</small> : null}
    </Field>
  )
}

function App() {
  const [plotConfig, setPlotConfig] = useState<PlotConfig>(() => createDefaultPlotConfig())
  const [activeTab, setActiveTab] = useState<ConfigTab>('General')
  const [activeDataframeIndex, setActiveDataframeIndex] = useState(0)
  const [activeFrameIndex, setActiveFrameIndex] = useState(0)
  const [activeLayerIndex, setActiveLayerIndex] = useState(0)
  const [alert, setAlert] = useState<AlertState | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const activeDataframe = plotConfig.dataframes[activeDataframeIndex] ?? plotConfig.dataframes[0]
  const activeFrame = activeDataframe.frames[activeFrameIndex] ?? activeDataframe.frames[0]

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
    setActiveFrameIndex(0)
    setActiveLayerIndex(0)
    setActiveTab('General')
    setAlert({ tone: 'success', message: 'Configuration reset to defaults.' })
  }

  const patchDataframe = (index: number, patch: (current: DataframeConfig) => DataframeConfig) => {
    setPlotConfig((current) => ({
      ...current,
      dataframes: current.dataframes.map((df, dfIndex) => (dfIndex === index ? patch(df) : df)),
    }))
  }

  const patchActiveDataframe = (patch: (current: DataframeConfig) => DataframeConfig) => {
    patchDataframe(activeDataframeIndex, patch)
  }

  const patchActiveFrame = (patch: (current: FrameConfig) => FrameConfig) => {
    patchActiveDataframe((dataframe) => ({
      ...dataframe,
      frames: dataframe.frames.map((frame, frameIndex) => (frameIndex === activeFrameIndex ? patch(frame) : frame)),
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

    setActiveDataframeIndex(plotConfig.dataframes.length)
    setActiveFrameIndex(0)
    setActiveLayerIndex(0)
    setAlert({ tone: 'success', message: 'Added dataframe.' })
  }

  const addFrame = () => {
    patchActiveDataframe((dataframe) => {
      const template = dataframe.frames[activeFrameIndex] ?? dataframe.frames[0]
      const clone: FrameConfig = {
        ...structuredClone(template),
        name: `Frame ${dataframe.frames.length + 1}`,
      }

      return {
        ...dataframe,
        createAllFrames:
          dataframe.createAllFrames === true ? true : [...dataframe.createAllFrames, dataframe.frames.length],
        frames: [...dataframe.frames, clone],
      }
    })
    setActiveFrameIndex(activeDataframe.frames.length)
    setActiveLayerIndex(0)
    setAlert({ tone: 'success', message: 'Added frame.' })
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
      setActiveFrameIndex(0)
      setActiveLayerIndex(0)
      setAlert({ tone: 'success', message: `Imported ${file.name} successfully.` })
    } catch {
      setAlert({ tone: 'error', message: 'Invalid config file. Please import valid JSON/JSONC.' })
    } finally {
      event.target.value = ''
    }
  }

  const updateAxis = (axisIndex: number, patch: (axis: AxisConfig) => AxisConfig) => {
    patchActiveDataframe((dataframe) => ({
      ...dataframe,
      axes: dataframe.axes.map((axis, index) => (index === axisIndex ? patch(axis) : axis)),
    }))
  }

  const addAxis = () => {
    patchActiveDataframe((dataframe) => ({
      ...dataframe,
      axes: [
        ...dataframe.axes,
        {
          name: `axis_${dataframe.axes.length + 1}`,
          columns: [],
          mode: 'default',
          labels: { [dataframe.language || 'en']: '' },
        },
      ],
    }))
  }

  const updateLayer = (layerIndex: number, patch: (layer: LayerConfig) => LayerConfig) => {
    patchActiveFrame((frame) => ({
      ...frame,
      layers: frame.layers.map((layer, index) => (index === layerIndex ? patch(layer) : layer)),
    }))
  }

  const addLayer = () => {
    patchActiveFrame((frame) => {
      const styleLayer = frame.layers[frame.layers.length - 1]
      const insertAt = Math.max(frame.layers.length - 1, 0)
      const nextLayer: LayerConfig = {
        name: `Layer ${insertAt + 1}`,
        whitelistFlag: false,
        whitelist: null,
        alpha: null,
        linewidth: 1.5,
      }

      return {
        ...frame,
        layers: [...frame.layers.slice(0, insertAt), nextLayer, styleLayer],
      }
    })
  }

  const renderGeneralTab = () => (
    <div className="grid gap-3 text-sm">
      <Field label="Config version" htmlFor="config-version">
        <Input
          id="config-version"
          type="number"
          min={1}
          step={1}
          value={plotConfig.version}
          onChange={(event) =>
            setPlotConfig((current) => ({
              ...current,
              version: numberValue(event.target.valueAsNumber, current.version),
            }))
          }
        />
      </Field>

      <Field label="Dataframe" htmlFor="dataframe-select">
        <Select
          id="dataframe-select"
          value={activeDataframeIndex}
          onChange={(event) => {
            setActiveDataframeIndex(Number(event.target.value))
            setActiveFrameIndex(0)
            setActiveLayerIndex(0)
          }}
        >
          {plotConfig.dataframes.map((dataframe, index) => (
            <option key={index} value={index}>
              {dataframe.name || `Dataframe ${index + 1}`}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="create_all_dataframes" htmlFor="create-all-dataframes">
        <Select
          id="create-all-dataframes"
          value={plotConfig.createAllDataframes === true ? 'all' : 'selected'}
          onChange={(event) =>
            setPlotConfig((current) => ({
              ...current,
              createAllDataframes: event.target.value === 'all' ? true : [activeDataframeIndex],
            }))
          }
        >
          <option value="all">Create all dataframes</option>
          <option value="selected">Create active dataframe only</option>
        </Select>
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Dataframe name" htmlFor="dataframe-name">
          <Input
            id="dataframe-name"
            value={activeDataframe.name ?? ''}
            onChange={(event) => patchActiveDataframe((current) => ({ ...current, name: event.target.value || null }))}
          />
        </Field>
        <Field label="language" htmlFor="dataframe-language">
          <Input
            id="dataframe-language"
            value={activeDataframe.language}
            onChange={(event) => patchActiveDataframe((current) => ({ ...current, language: event.target.value }))}
          />
        </Field>
      </div>

      <CheckboxField
        label="Dataframe dark_mode"
        checked={activeDataframe.darkMode}
        onChange={(checked) => patchActiveDataframe((current) => ({ ...current, darkMode: checked }))}
      />

      <Field label="Frame" htmlFor="frame-select">
        <Select
          id="frame-select"
          value={activeFrameIndex}
          onChange={(event) => {
            setActiveFrameIndex(Number(event.target.value))
            setActiveLayerIndex(0)
          }}
        >
          {activeDataframe.frames.map((frame, index) => (
            <option key={index} value={index}>
              {frame.name || `Frame ${index + 1}`}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="create_all_frames" htmlFor="create-all-frames">
        <Select
          id="create-all-frames"
          value={activeDataframe.createAllFrames === true ? 'all' : 'selected'}
          onChange={(event) =>
            patchActiveDataframe((current) => ({
              ...current,
              createAllFrames: event.target.value === 'all' ? true : [activeFrameIndex],
            }))
          }
        >
          <option value="all">Create all frames</option>
          <option value="selected">Create active frame only</option>
        </Select>
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Frame name" htmlFor="frame-name">
          <Input
            id="frame-name"
            value={activeFrame.name ?? ''}
            onChange={(event) => patchActiveFrame((current) => ({ ...current, name: event.target.value || null }))}
          />
        </Field>
        <Field label="export_file_name" htmlFor="export-file-name">
          <Input
            id="export-file-name"
            value={activeFrame.exportFileName ?? ''}
            placeholder="folder/name"
            onChange={(event) =>
              patchActiveFrame((current) => ({ ...current, exportFileName: event.target.value || null }))
            }
          />
        </Field>
      </div>

      <Field label="title.en" htmlFor="frame-title-en">
        <Input
          id="frame-title-en"
          value={activeFrame.title.en ?? ''}
          onChange={(event) =>
            patchActiveFrame((current) => ({ ...current, title: { ...current.title, en: event.target.value } }))
          }
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="algorithm" htmlFor="algorithm">
          <Select
            id="algorithm"
            value={activeFrame.algorithm}
            onChange={(event) =>
              patchActiveFrame((current) => ({
                ...current,
                algorithm: event.target.value as FrameConfig['algorithm'],
              }))
            }
          >
            {PLOT_ALGORITHMS.map((algorithm) => (
              <option key={algorithm} value={algorithm}>
                {algorithm}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="automatic_Display_Area_margin" htmlFor="display-margin">
          <Input
            id="display-margin"
            type="number"
            step={0.01}
            value={activeFrame.automaticDisplayAreaMargin}
            onChange={(event) =>
              patchActiveFrame((current) => ({
                ...current,
                automaticDisplayAreaMargin: numberValue(event.target.valueAsNumber, current.automaticDisplayAreaMargin),
              }))
            }
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <CheckboxField
          label="legend_flag"
          checked={activeFrame.legendFlag}
          onChange={(checked) => patchActiveFrame((current) => ({ ...current, legendFlag: checked }))}
        />
        <CheckboxField
          label="Frame dark_mode"
          checked={activeFrame.darkMode}
          onChange={(checked) => patchActiveFrame((current) => ({ ...current, darkMode: checked }))}
        />
        <CheckboxField
          label="legend_above"
          checked={activeFrame.legendAbove ?? false}
          onChange={(checked) => patchActiveFrame((current) => ({ ...current, legendAbove: checked }))}
        />
      </div>

      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addFrame}>
        Add frame
      </Button>
    </div>
  )

  const renderAxesTab = () => {
    const selectedAxisIndex = Math.max(
      activeDataframe.axes.findIndex((axis) => axis.name === activeFrame.xQuantity),
      0,
    )
    const selectedAxis = activeDataframe.axes[selectedAxisIndex]

    return (
      <div className="grid gap-3 text-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="x_quantity" htmlFor="x-quantity">
            <Select
              id="x-quantity"
              value={activeFrame.xQuantity}
              onChange={(event) => patchActiveFrame((current) => ({ ...current, xQuantity: event.target.value }))}
            >
              {activeDataframe.axes.map((axis) => (
                <option key={axis.name} value={axis.name}>
                  {axis.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="y_quantity" htmlFor="y-quantity">
            <Select
              id="y-quantity"
              value={activeFrame.yQuantity}
              onChange={(event) => patchActiveFrame((current) => ({ ...current, yQuantity: event.target.value }))}
            >
              {activeDataframe.axes.map((axis) => (
                <option key={axis.name} value={axis.name}>
                  {axis.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="x_rel_quantity" htmlFor="x-rel-quantity">
            <Input
              id="x-rel-quantity"
              value={activeFrame.xRelQuantity ?? ''}
              onChange={(event) =>
                patchActiveFrame((current) => ({ ...current, xRelQuantity: event.target.value || null }))
              }
            />
          </Field>
          <Field label="y_rel_quantity" htmlFor="y-rel-quantity">
            <Input
              id="y-rel-quantity"
              value={activeFrame.yRelQuantity ?? ''}
              onChange={(event) =>
                patchActiveFrame((current) => ({ ...current, yRelQuantity: event.target.value || null }))
              }
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CheckboxField
            label="log_x_flag"
            checked={activeFrame.logXFlag}
            onChange={(checked) => patchActiveFrame((current) => ({ ...current, logXFlag: checked }))}
          />
          <CheckboxField
            label="log_y_flag"
            checked={activeFrame.logYFlag}
            onChange={(checked) => patchActiveFrame((current) => ({ ...current, logYFlag: checked }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="x_lim" hint="Leave disabled for automatic bounds.">
            <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-violet-600"
                checked={activeFrame.xLim !== null}
                onChange={(event) =>
                  patchActiveFrame((current) => ({ ...current, xLim: event.target.checked ? [0, 0] : null }))
                }
              />
              <Input
                type="number"
                disabled={activeFrame.xLim === null}
                value={activeFrame.xLim?.[0] ?? ''}
                onChange={(event) =>
                  patchActiveFrame((current) => ({
                    ...current,
                    xLim: [numberValue(event.target.valueAsNumber, current.xLim?.[0] ?? 0), current.xLim?.[1] ?? 0],
                  }))
                }
              />
              <Input
                type="number"
                disabled={activeFrame.xLim === null}
                value={activeFrame.xLim?.[1] ?? ''}
                onChange={(event) =>
                  patchActiveFrame((current) => ({
                    ...current,
                    xLim: [current.xLim?.[0] ?? 0, numberValue(event.target.valueAsNumber, current.xLim?.[1] ?? 0)],
                  }))
                }
              />
            </div>
          </Field>
          <Field label="y_lim" hint="Leave disabled for automatic bounds.">
            <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-violet-600"
                checked={activeFrame.yLim !== null}
                onChange={(event) =>
                  patchActiveFrame((current) => ({ ...current, yLim: event.target.checked ? [0, 0] : null }))
                }
              />
              <Input
                type="number"
                disabled={activeFrame.yLim === null}
                value={activeFrame.yLim?.[0] ?? ''}
                onChange={(event) =>
                  patchActiveFrame((current) => ({
                    ...current,
                    yLim: [numberValue(event.target.valueAsNumber, current.yLim?.[0] ?? 0), current.yLim?.[1] ?? 0],
                  }))
                }
              />
              <Input
                type="number"
                disabled={activeFrame.yLim === null}
                value={activeFrame.yLim?.[1] ?? ''}
                onChange={(event) =>
                  patchActiveFrame((current) => ({
                    ...current,
                    yLim: [current.yLim?.[0] ?? 0, numberValue(event.target.valueAsNumber, current.yLim?.[1] ?? 0)],
                  }))
                }
              />
            </div>
          </Field>
        </div>

        {selectedAxis ? (
          <div className="grid gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <Field label="Axis to edit" htmlFor="axis-select">
              <Select
                id="axis-select"
                value={selectedAxisIndex}
                onChange={(event) => {
                  const nextAxis = activeDataframe.axes[Number(event.target.value)]
                  if (nextAxis) {
                    patchActiveFrame((current) => ({ ...current, xQuantity: nextAxis.name }))
                  }
                }}
              >
                {activeDataframe.axes.map((axis, index) => (
                  <option key={`${axis.name}-${index}`} value={index}>
                    {axis.name || `Axis ${index + 1}`}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="axis.name" htmlFor="axis-name">
                <Input
                  id="axis-name"
                  value={selectedAxis.name}
                  onChange={(event) => updateAxis(selectedAxisIndex, (axis) => ({ ...axis, name: event.target.value }))}
                />
              </Field>
              <Field label="axis.mode" htmlFor="axis-mode">
                <Select
                  id="axis-mode"
                  value={selectedAxis.mode}
                  onChange={(event) =>
                    updateAxis(selectedAxisIndex, (axis) => ({ ...axis, mode: event.target.value as AxisConfig['mode'] }))
                  }
                >
                  {AXIS_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="axis.columns" htmlFor="axis-columns" hint="Comma-separated source column names.">
              <Input
                id="axis-columns"
                value={stringifyCsv(selectedAxis.columns)}
                onChange={(event) =>
                  updateAxis(selectedAxisIndex, (axis) => ({ ...axis, columns: parseCsv(event.target.value) }))
                }
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="labels.en" htmlFor="axis-label-en">
                <Input
                  id="axis-label-en"
                  value={selectedAxis.labels.en ?? ''}
                  onChange={(event) =>
                    updateAxis(selectedAxisIndex, (axis) => ({
                      ...axis,
                      labels: { ...axis.labels, en: event.target.value },
                    }))
                  }
                />
              </Field>
              <Field label="labels.de" htmlFor="axis-label-de">
                <Input
                  id="axis-label-de"
                  value={selectedAxis.labels.de ?? ''}
                  onChange={(event) =>
                    updateAxis(selectedAxisIndex, (axis) => ({
                      ...axis,
                      labels: { ...axis.labels, de: event.target.value },
                    }))
                  }
                />
              </Field>
            </div>
          </div>
        ) : null}

        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addAxis}>
          Add axis
        </Button>
      </div>
    )
  }

  const renderLayersTab = () => {
    const editableLayerCount = Math.max(activeFrame.layers.length - 1, 1)
    const selectedLayerIndex = Math.min(activeLayerIndex, editableLayerCount - 1)
    const layer = activeFrame.layers[selectedLayerIndex] ?? {}
    const styleLayer = activeFrame.layers[activeFrame.layers.length - 1] ?? {}

    return (
      <div className="grid gap-3 text-sm">
        <Field label="Layer" htmlFor="layer-select">
          <Select id="layer-select" value={selectedLayerIndex} onChange={(event) => setActiveLayerIndex(Number(event.target.value))}>
            {activeFrame.layers.slice(0, editableLayerCount).map((entry, index) => (
              <option key={index} value={index}>
                {entry.name || `Layer ${index + 1}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`layers[${selectedLayerIndex}].name`} htmlFor="layer-name">
          <Input
            id="layer-name"
            value={layer.name ?? ''}
            onChange={(event) => updateLayer(selectedLayerIndex, (current) => ({ ...current, name: event.target.value }))}
          />
        </Field>
        <CheckboxField
          label="whitelist_flag"
          checked={layer.whitelistFlag ?? false}
          onChange={(checked) => updateLayer(selectedLayerIndex, (current) => ({ ...current, whitelistFlag: checked }))}
        />
        <Field label="whitelist" htmlFor="layer-whitelist" hint="Comma-separated filter words, blank for null.">
          <Input
            id="layer-whitelist"
            value={stringifyCsv(layer.whitelist)}
            onChange={(event) =>
              updateLayer(selectedLayerIndex, (current) => {
                const whitelist = parseCsv(event.target.value)
                return { ...current, whitelist: whitelist.length > 0 ? whitelist : null }
              })
            }
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="alpha" htmlFor="layer-alpha">
            <Input
              id="layer-alpha"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={layer.alpha ?? ''}
              onChange={(event) =>
                updateLayer(selectedLayerIndex, (current) => ({
                  ...current,
                  alpha: Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : null,
                }))
              }
            />
          </Field>
          <Field label="linewidth" htmlFor="layer-linewidth">
            <Input
              id="layer-linewidth"
              type="number"
              min={0}
              step={0.1}
              value={layer.linewidth ?? 0}
              onChange={(event) =>
                updateLayer(selectedLayerIndex, (current) => ({
                  ...current,
                  linewidth: numberValue(event.target.valueAsNumber, current.linewidth ?? 0),
                }))
              }
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 border-t border-zinc-200 pt-3 sm:grid-cols-2 dark:border-zinc-800">
          <Field label="alpha_points" htmlFor="alpha-points">
            <Input
              id="alpha-points"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={styleLayer.alphaPoints ?? ''}
              onChange={(event) =>
                updateLayer(activeFrame.layers.length - 1, (current) => ({
                  ...current,
                  alphaPoints: Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : null,
                }))
              }
            />
          </Field>
          <Field label="alpha_areas" htmlFor="alpha-areas">
            <Input
              id="alpha-areas"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={styleLayer.alphaAreas ?? ''}
              onChange={(event) =>
                updateLayer(activeFrame.layers.length - 1, (current) => ({
                  ...current,
                  alphaAreas: Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : null,
                }))
              }
            />
          </Field>
        </div>
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addLayer}>
          Add layer
        </Button>
      </div>
    )
  }

  const renderStylingTab = () => (
    <div className="grid gap-3 text-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="image_ratio" htmlFor="image-ratio">
          <Input
            id="image-ratio"
            type="number"
            step={0.01}
            value={activeDataframe.imageRatio}
            onChange={(event) =>
              patchActiveDataframe((current) => ({
                ...current,
                imageRatio: numberValue(event.target.valueAsNumber, current.imageRatio),
              }))
            }
          />
        </Field>
        <Field label="resolution" htmlFor="resolution">
          <Input
            id="resolution"
            value={String(activeDataframe.resolution)}
            onChange={(event) =>
              patchActiveDataframe((current) => {
                const parsed = Number(event.target.value)
                return {
                  ...current,
                  resolution: event.target.value === 'svg' || !Number.isFinite(parsed) ? 'svg' : parsed,
                }
              })
            }
          />
        </Field>
      </div>
      <Field label="legend_title.en" htmlFor="legend-title-en">
        <Input
          id="legend-title-en"
          value={activeDataframe.legendTitle.en ?? ''}
          onChange={(event) =>
            patchActiveDataframe((current) => ({
              ...current,
              legendTitle: { ...current.legendTitle, en: event.target.value },
            }))
          }
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="font_style" htmlFor="font-style">
          <Input
            id="font-style"
            value={activeDataframe.font.fontStyle}
            onChange={(event) =>
              patchActiveDataframe((current) => ({
                ...current,
                font: { ...current.font, fontStyle: event.target.value },
              }))
            }
          />
        </Field>
        <Field label="font" htmlFor="font-family">
          <Input
            id="font-family"
            value={activeDataframe.font.font}
            onChange={(event) =>
              patchActiveDataframe((current) => ({
                ...current,
                font: { ...current.font, font: event.target.value },
              }))
            }
          />
        </Field>
        <Field label="font_size" htmlFor="font-size">
          <Input
            id="font-size"
            type="number"
            min={1}
            step={1}
            value={activeDataframe.font.fontSize}
            onChange={(event) =>
              patchActiveDataframe((current) => ({
                ...current,
                font: { ...current.font, fontSize: numberValue(event.target.valueAsNumber, current.font.fontSize) },
              }))
            }
          />
        </Field>
      </div>
      <div className="grid gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">material_colors</span>
        {Object.entries(activeDataframe.materialColors).map(([material, color]) => (
          <div key={material} className="grid grid-cols-[1fr_120px] gap-2">
            <Input
              value={material}
              aria-label={`${material} material name`}
              onChange={(event) =>
                patchActiveDataframe((current) => {
                  const { [material]: existingColor, ...rest } = current.materialColors
                  return {
                    ...current,
                    materialColors: { ...rest, [event.target.value]: existingColor },
                  }
                })
              }
            />
            <Input
              value={color ?? ''}
              aria-label={`${material} color`}
              placeholder="#000000"
              onChange={(event) =>
                patchActiveDataframe((current) => ({
                  ...current,
                  materialColors: {
                    ...current.materialColors,
                    [material]: event.target.value || null,
                  },
                }))
              }
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            patchActiveDataframe((current) => ({
              ...current,
              materialColors: { ...current.materialColors, [`Material ${Object.keys(current.materialColors).length}`]: '#000000' },
            }))
          }
        >
          Add color
        </Button>
      </div>
    </div>
  )

  const renderAdvancedTab = () => (
    <div className="grid gap-3 text-sm">
      <JsonEditor
        key={`filter-${activeDataframeIndex}-${activeFrameIndex}`}
        label="filter"
        value={activeFrame.filter ?? {}}
        onCommit={(value) =>
          patchActiveFrame((current) => ({
            ...current,
            filter: value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null,
          }))
        }
      />
      <JsonEditor
        key={`guidelines-${activeDataframeIndex}-${activeFrameIndex}`}
        label="guidelines"
        value={activeFrame.guidelines}
        onCommit={(value) =>
          patchActiveFrame((current) => ({
            ...current,
            guidelines: Array.isArray(value) ? (value as FrameConfig['guidelines']) : current.guidelines,
          }))
        }
      />
      <JsonEditor
        key={`annotations-${activeDataframeIndex}-${activeFrameIndex}`}
        label="annotations"
        value={activeFrame.annotations}
        onCommit={(value) =>
          patchActiveFrame((current) => ({
            ...current,
            annotations: Array.isArray(value) ? (value as FrameConfig['annotations']) : current.annotations,
          }))
        }
      />
      <JsonEditor
        key={`areas-${activeDataframeIndex}-${activeFrameIndex}`}
        label="colored_areas"
        value={activeFrame.coloredAreas}
        onCommit={(value) =>
          patchActiveFrame((current) => ({
            ...current,
            coloredAreas: Array.isArray(value) ? (value as FrameConfig['coloredAreas']) : current.coloredAreas,
          }))
        }
      />
      <JsonEditor
        key={`hulls-${activeDataframeIndex}-${activeFrameIndex}`}
        label="highlighted_hulls"
        value={activeFrame.highlightedHulls}
        onCommit={(value) =>
          patchActiveFrame((current) => ({
            ...current,
            highlightedHulls: Array.isArray(value) ? (value as FrameConfig['highlightedHulls']) : current.highlightedHulls,
          }))
        }
      />
    </div>
  )

  const renderTabContent = () => {
    if (activeTab === 'General') {
      return renderGeneralTab()
    }

    if (activeTab === 'Data Source') {
      return (
        <DataSourceSection
          plotConfig={plotConfig}
          activeDataframeIndex={activeDataframeIndex}
          onPatchDataframe={patchDataframe}
          onAddDataframe={addDataframe}
        />
      )
    }

    if (activeTab === 'Axes') {
      return renderAxesTab()
    }

    if (activeTab === 'Layers') {
      return renderLayersTab()
    }

    if (activeTab === 'Styling') {
      return renderStylingTab()
    }

    return renderAdvancedTab()
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
            {renderTabContent()}
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
