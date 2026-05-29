import type { Dispatch, SetStateAction } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import type { AxisConfig, DataframeConfig } from '../config/defaultPlotConfig'
import type { UILanguage } from '../uiTranslations'

type MultiOption = { value: string; label: string }

type Props = {
  t: (key: string) => string
  uiLanguage: UILanguage
  activeDataframe: DataframeConfig
  hoveredRemoveGroup: string | null
  setHoveredRemoveGroup: (value: string | null) => void
  addAxis: () => void
  removeAxis: (index: number) => void
  updateAxis: (index: number, updater: (axis: AxisConfig) => AxisConfig) => void
  availableAxisColumns: MultiOption[]
  expandedAxisColumns: Record<number, boolean>
  setExpandedAxisColumns: Dispatch<SetStateAction<Record<number, boolean>>>
  AXIS_MODES: readonly AxisConfig['mode'][]
  FieldComponent: any
  MultiSelectInputComponent: any
  RemoveIconButtonComponent: any
}

export const addAxisToDataframe = (df: DataframeConfig): DataframeConfig => ({
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
})

export const updateAxisInDataframe = (df: DataframeConfig, axisIndex: number, patch: (axis: AxisConfig) => AxisConfig): DataframeConfig => ({
  ...df,
  axes: df.axes.map((axis, index) => (index === axisIndex ? patch(axis) : axis)),
})

export function AxesSection({ t, uiLanguage, activeDataframe, hoveredRemoveGroup, setHoveredRemoveGroup, addAxis, removeAxis, updateAxis, availableAxisColumns, expandedAxisColumns, setExpandedAxisColumns, AXIS_MODES, FieldComponent: Field, MultiSelectInputComponent: MultiSelectInput, RemoveIconButtonComponent: RemoveIconButton }: Props) {
  return <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold">{t('axes')}</h3><Button variant="outline" size="sm" onClick={addAxis}>+ Axes</Button></div>{activeDataframe.axes.map((axis, axisIndex) => (<div key={axisIndex} className={`relative grid gap-3 rounded-lg border bg-zinc-50 p-3 pr-12 dark:bg-zinc-900 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] ${hoveredRemoveGroup === `axis-${axisIndex}` ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}><RemoveIconButton onHoverChange={(hovered: boolean) => setHoveredRemoveGroup(hovered ? `axis-${axisIndex}` : null)} onClick={() => removeAxis(axisIndex)} /><div className="grid gap-2"><Field language={uiLanguage} label={`Axis ${axisIndex + 1} Name`} jsonPath={`axes[${axisIndex}].name`}><Input value={axis.name} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, name: e.target.value }))} /></Field><Field language={uiLanguage} label={`Axis ${axisIndex + 1} Mode`} jsonPath={`axes[${axisIndex}].mode`}><Select value={axis.mode} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, mode: e.target.value as AxisConfig['mode'] }))}>{AXIS_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</Select></Field><div className="grid gap-2"><label className="font-medium text-zinc-900 dark:text-zinc-100">Axis {axisIndex + 1} Label</label>{activeDataframe.plotLanguages.map((lang) => (<div key={`axis-${axisIndex}-${lang}`} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2"><span className="text-xs uppercase text-zinc-600">{lang}</span><Input value={axis.labels[lang] ?? ''} onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, labels: { ...a.labels, [lang]: e.target.value } }))} /></div>))}</div></div><MultiSelectInput title={`Axis ${axisIndex + 1} Columns`} value={axis.columns} options={availableAxisColumns} expanded={expandedAxisColumns[axisIndex] === true} onToggleExpanded={() => setExpandedAxisColumns((current) => ({ ...current, [axisIndex]: !current[axisIndex] }))} hideModeToggle onChange={(next: string[]) => updateAxis(axisIndex, (a) => ({ ...a, columns: next }))} /></div>))}</section>
}
