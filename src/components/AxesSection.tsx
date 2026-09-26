import type { Dispatch, SetStateAction } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import { AXIS_MODES, type AxisConfig, type DataframeConfig } from '../config/defaultPlotConfig'
import { useI18n } from '../uiTranslations'
import type { MultiOption } from '../utils/appState'
import { DuplicateIconButton, Field, MultiSelectInput, RemoveIconButton } from './AppControls'

type Props = {
  activeDataframe: DataframeConfig
  patchActiveDataframe: (updater: (dataframe: DataframeConfig) => DataframeConfig) => void
  hoveredRemoveGroup: string | null
  setHoveredRemoveGroup: (value: string | null) => void
  addAxis: () => void
  removeAxis: (index: number) => void
  updateAxis: (index: number, updater: (axis: AxisConfig) => AxisConfig) => void
  availableAxisColumns: MultiOption[]
  expandedAxisColumns: Record<number, boolean>
  setExpandedAxisColumns: Dispatch<SetStateAction<Record<number, boolean>>>
}

export function AxesSection({
  activeDataframe,
  patchActiveDataframe,
  hoveredRemoveGroup,
  setHoveredRemoveGroup,
  addAxis,
  removeAxis,
  updateAxis,
  availableAxisColumns,
  expandedAxisColumns,
  setExpandedAxisColumns,
}: Props) {
  const { t } = useI18n()
  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent">
      <div className="flex items-center gap-2">
        <h3 className="m-0 text-m font-semibold text-violet-500">{t('axes')}</h3>
        <Button variant="outline" size="sm" onClick={addAxis}>
          + {t('axis')}
        </Button>
      </div>

      {activeDataframe.axes.map((axis, axisIndex) => (
        <div
          key={axisIndex}
          className={`relative grid gap-3 rounded-lg border bg-zinc-50 p-2 pr-15 dark:bg-zinc-900 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] ${
            hoveredRemoveGroup === `axis-${axisIndex}`
              ? 'border-red-500'
              : 'border-zinc-300 dark:border-zinc-700'
          }`}
        >
          <DuplicateIconButton
            onClick={() => patchActiveDataframe((df) => ({
              ...df,
              axes: [
                ...df.axes.slice(0, axisIndex + 1),
                structuredClone(df.axes[axisIndex]),
                ...df.axes.slice(axisIndex + 1),
              ],
            }))}
          />
          <RemoveIconButton
            onHoverChange={(hovered) => setHoveredRemoveGroup(hovered ? `axis-${axisIndex}` : null)}
            onClick={() => removeAxis(axisIndex)}
          />

          <div className="grid gap-2">
            <Field label={t('axisName', { n: axisIndex + 1 })} jsonPath={`axes[${axisIndex}].name`}>
              <Input
                value={axis.name}
                onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, name: e.target.value }))}
              />
            </Field>

            <Field label={t('axisMode', { n: axisIndex + 1 })} jsonPath={`axes[${axisIndex}].mode`}>
              <Select
                value={axis.mode}
                onChange={(e) => updateAxis(axisIndex, (a) => ({ ...a, mode: e.target.value as AxisConfig['mode'] }))}
              >
                {AXIS_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-2">
              <label className="font-medium text-zinc-900 dark:text-zinc-100">{t('axisLabel', { n: axisIndex + 1 })}</label>
              {activeDataframe.plotLanguages.map((lang) => (
                <div key={`axis-${axisIndex}-${lang}`} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
                  <span className="text-xs uppercase text-zinc-600 dark:text-zinc-300">{lang}</span>
                  <Input
                    value={axis.labels[lang] ?? ''}
                    onChange={(e) =>
                      updateAxis(axisIndex, (a) => ({
                        ...a,
                        labels: { ...a.labels, [lang]: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <MultiSelectInput
            title={t('axisColumns', { n: axisIndex + 1 })}
            value={axis.columns}
            options={availableAxisColumns}
            expanded={expandedAxisColumns[axisIndex] === true}
            onToggleExpanded={() =>
              setExpandedAxisColumns((current) => ({
                ...current,
                [axisIndex]: !current[axisIndex],
              }))
            }
            hideModeToggle
            onChange={(next) => updateAxis(axisIndex, (a) => ({ ...a, columns: next }))}
          />
        </div>
      ))}
    </section>
  )
}
