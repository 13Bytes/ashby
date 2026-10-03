import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { AXIS_MODES, type AxisConfig, type DataframeConfig } from '../../config/defaultPlotConfig'
import { useI18n } from '../../uiTranslations'
import type { MultiOption } from '../../utils/appState'
import { addAxisToDataframe, axisRenameMovesReferences, renameAxisInDataframe } from '../../utils/configEditing'
import { Field, ItemCard, LanguageFields, MultiSelectInput, Toggle } from '../common/AppControls'
import { useOpenItems } from '../../hooks/useOpenItems'

type Props = {
  activeDataframe: DataframeConfig
  patchActiveDataframe: (updater: (dataframe: DataframeConfig) => DataframeConfig) => void
  addAxis: () => void
  removeAxis: (index: number) => void
  updateAxis: (index: number, updater: (axis: AxisConfig) => AxisConfig) => void
  availableAxisColumns: MultiOption[]
  expandedAxisColumns: Record<number, boolean>
  setExpandedAxisColumns: Dispatch<SetStateAction<Record<number, boolean>>>
}

/** Axis definitions of the dataframe: named quantities and the spreadsheet columns they come from. */
export function AxesSection({
  activeDataframe,
  patchActiveDataframe,
  addAxis,
  removeAxis,
  updateAxis,
  availableAxisColumns,
  expandedAxisColumns,
  setExpandedAxisColumns,
}: Props) {
  const { t } = useI18n()
  const language = activeDataframe.language
  const openItems = useOpenItems(String(activeDataframe._extensions.uiKey))
  /**
   * While an ID is being edited: the name the frames still refer to, when the field is empty or holds
   * another axis' ID for a moment. The references follow once the ID is unique again.
   */
  const pendingNames = useRef<Record<number, string>>({})
  const renameAxis = (axisIndex: number, name: string) => {
    const previousName = pendingNames.current[axisIndex] ?? activeDataframe.axes[axisIndex].name
    if (axisRenameMovesReferences(activeDataframe, axisIndex, name, previousName) || name === previousName) delete pendingNames.current[axisIndex]
    else pendingNames.current[axisIndex] = previousName
    patchActiveDataframe((df) => renameAxisInDataframe(df, axisIndex, name, previousName))
  }
  // A dataset without axes gets two empty ones (for X and Y) when this section is shown, opened.
  const withoutAxes = activeDataframe.axes.length === 0
  useEffect(() => {
    if (!withoutAxes) return
    patchActiveDataframe((df) => (df.axes.length > 0 ? df : addAxisToDataframe(addAxisToDataframe(df))))
    openItems.added(0)
    openItems.added(1)
  }, [withoutAxes, patchActiveDataframe, openItems])
  return (
    <>
      <div className="grid gap-2" data-anchor="axes">
        {activeDataframe.axes.map((axis, axisIndex) => {
          const incomplete = !axis.name.trim() || axis.columns.length === 0
          return (
            <ItemCard
              key={axisIndex}
              open={openItems.isOpen(axisIndex)}
              onOpenChange={(next) => openItems.setOpen(axisIndex, next)}
              title={<code className="font-mono text-[13px]">{axis.name || `axis ${axisIndex + 1}`}</code>}
              summary={[axis.labels[language], t('columnsCount', { count: axis.columns.length })].filter(Boolean).join(' · ')}
              badge={incomplete
                ? <span className="rounded-full bg-orange-600 px-2 text-[11px] font-semibold text-white">{t('levelRequired')}</span>
                : axis.mode !== 'default' ? <span className="rounded-full px-2 text-[11px] text-zinc-500 ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700">{axis.mode}</span> : null}
              onDuplicate={() => {
                openItems.inserted(axisIndex + 1)
                patchActiveDataframe((df) => ({
                ...df,
                  axes: [...df.axes.slice(0, axisIndex + 1), structuredClone(df.axes[axisIndex]), ...df.axes.slice(axisIndex + 1)],
                }))
              }}
              onRemove={() => {
                openItems.removed(axisIndex)
                removeAxis(axisIndex)
              }}
              removeDisabled={activeDataframe.axes.length <= 1}
            >
              <div className="grid items-stretch gap-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <div className="grid content-start gap-4">
                  <Field label={t('axisName', { n: axisIndex + 1 })} jsonPath={`axes[${axisIndex}].name`} level="required" missing={!axis.name.trim()}>
                    <Input value={axis.name} onChange={(e) => renameAxis(axisIndex, e.target.value)} onBlur={() => { delete pendingNames.current[axisIndex] }} />
                  </Field>
                  <LanguageFields
                    label={t('axisLabel', { n: axisIndex + 1 })}
                    jsonPath={`axes[${axisIndex}].labels`}
                    level="check"
                    languages={activeDataframe.plotLanguages}
                    selectedLanguage={language}
                    value={(lang) => axis.labels[lang] ?? ''}
                    onChange={(lang, next) => updateAxis(axisIndex, (a) => ({ ...a, labels: { ...a.labels, [lang]: next } }))}
                  />
                  <Field label={t('axisMode', { n: axisIndex + 1 })} jsonPath={`axes[${axisIndex}].mode`} level="default" changed={axis.mode !== 'default'} onReset={() => updateAxis(axisIndex, (a) => ({ ...a, mode: 'default' }))}>
                    <Toggle fill ariaLabel={t('axisMode', { n: axisIndex + 1 })} value={axis.mode} options={AXIS_MODES.map((mode) => ({ value: mode, label: mode }))} onChange={(mode) => updateAxis(axisIndex, (a) => ({ ...a, mode }))} />
                  </Field>
                </div>
                <Field label={t('axisColumns', { n: axisIndex + 1 })} jsonPath={`axes[${axisIndex}].columns`} level="required" missing={axis.columns.length === 0} fill>
                  <MultiSelectInput
                    title=""
                    value={axis.columns}
                    // Selected columns first: the list can hold hundreds of columns.
                    options={[...availableAxisColumns.filter((option) => axis.columns.includes(option.value)), ...availableAxisColumns.filter((option) => !axis.columns.includes(option.value))]}
                    expanded={expandedAxisColumns[axisIndex] === true}
                    onToggleExpanded={() => setExpandedAxisColumns((current) => ({ ...current, [axisIndex]: !current[axisIndex] }))}
                    hideModeToggle
                    onChange={(next) => updateAxis(axisIndex, (a) => ({ ...a, columns: next }))}
                  />
                </Field>
              </div>
            </ItemCard>
          )
        })}
      </div>
      <div data-always>
        <Button variant="outline" size="sm" onClick={() => {
          openItems.added(activeDataframe.axes.length)
          addAxis()
        }}>+ {t('axis')}</Button>
      </div>
    </>
  )
}
