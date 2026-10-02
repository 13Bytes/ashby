import { useId, useState, type ComponentProps } from 'react'
import type { FrameConfig } from '../../config/defaultPlotConfig'
import { DEFAULT_FRAME } from '../../config/settingsSections'
import { useI18n, type LabelKey } from '../../uiTranslations'
import { formatList, isFilterGroup, newCondition, operatorsFor, parseList, readFilter, valueKind, withOperator, writeFilter, type FilterCondition, type FilterGroup, type FilterNode, type FilterOperator, type FilterValue } from '../../utils/rowFilter'
import { Field, SettingsGroup } from '../common/AppControls'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select } from '../ui/select'

type Props = {
  activeFrame: FrameConfig
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  /** Columns of the imported source; empty before the import. */
  availableColumns: string[]
  availableKeywordsByColumn: Record<string, string[]>
}

const OPERATOR_LABELS: Record<FilterOperator, LabelKey> = {
  is: 'filterOpIs',
  isNot: 'filterOpIsNot',
  contains: 'filterOpContains',
  doesNotContain: 'filterOpDoesNotContain',
  isAnyOf: 'filterOpIsAnyOf',
  isNoneOf: 'filterOpIsNoneOf',
  isEmpty: 'filterOpIsEmpty',
  isNotEmpty: 'filterOpIsNotEmpty',
  isGreater: 'filterOpIsGreater',
  isGreaterEqual: 'filterOpIsGreaterEqual',
  isLess: 'filterOpIsLess',
  isLessEqual: 'filterOpIsLessEqual',
}

const RemoveIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
    <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />
  </svg>
)

/** Values separated by commas; the text stays as typed while editing ("PC, "). */
function ListInput({ value, onChange, ...props }: { value: FilterValue; onChange: (next: string[]) => void } & Omit<ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Input
      {...props}
      value={draft ?? formatList(value)}
      onChange={(e) => {
        setDraft(e.target.value)
        onChange(parseList(e.target.value))
      }}
      onBlur={() => setDraft(null)}
    />
  )
}

/** Which rows of the source this plot uses, built like Teable's filter: conditions joined by and/or, and condition groups. */
export function FilterSection({ activeFrame, patchActiveFrame, availableColumns, availableKeywordsByColumn }: Props) {
  const { t } = useI18n()
  const idBase = useId()
  const filter = readFilter(activeFrame.filter)
  const setFilter = (next: FilterGroup) => patchActiveFrame((f) => ({ ...f, filter: writeFilter(next) }))
  // Text columns have text values; other imported columns hold numbers. Before the import, all operators are offered.
  const columnKind = (column: string) =>
    (availableKeywordsByColumn[column] ?? []).length > 0 ? 'text' : availableColumns.includes(column) ? 'number' : undefined

  const conditionRow = (condition: FilterCondition, onChange: (next: FilterCondition) => void, onRemove: () => void, path: string) => {
    const columns = condition.fieldId && !availableColumns.includes(condition.fieldId) ? [condition.fieldId, ...availableColumns] : availableColumns
    const operators: readonly string[] = operatorsFor(columnKind(condition.fieldId))
    const keywords = availableKeywordsByColumn[condition.fieldId] ?? []
    const listId = `${idBase}${path}`
    const kind = valueKind(condition.operator)
    return (
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-2 @xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
        {columns.length > 0 ? (
          <Select aria-label={t('filterColumn')} value={condition.fieldId} onChange={(e) => onChange({ ...condition, fieldId: e.target.value })} className="col-span-2 @xl:col-span-1">
            <option value="">{t('selectColumn')}</option>
            {columns.map((column) => <option key={column} value={column}>{column}</option>)}
          </Select>
        ) : (
          <Input aria-label={t('filterColumn')} placeholder={t('filterColumn')} value={condition.fieldId} onChange={(e) => onChange({ ...condition, fieldId: e.target.value })} className="col-span-2 @xl:col-span-1" />
        )}
        <Select aria-label={t('filterOperator')} value={condition.operator} onChange={(e) => onChange(withOperator(condition, e.target.value))}>
          {operators.includes(condition.operator) ? null : <option value={condition.operator}>{condition.operator}</option>}
          {operators.map((operator) => <option key={operator} value={operator}>{t(OPERATOR_LABELS[operator as FilterOperator])}</option>)}
        </Select>
        <div className="col-span-2 row-start-3 @xl:col-span-1 @xl:row-start-auto">
          {kind === 'none' ? null : kind === 'list' ? (
            <ListInput aria-label={t('filterValues')} placeholder={t('filterValues')} value={condition.value} onChange={(value) => onChange({ ...condition, value })} />
          ) : (
            <>
              <Input
                aria-label={t('filterValue')}
                placeholder={t('filterValue')}
                list={keywords.length > 0 ? listId : undefined}
                inputMode={columnKind(condition.fieldId) === 'number' ? 'decimal' : undefined}
                value={typeof condition.value === 'string' ? condition.value : ''}
                onChange={(e) => onChange({ ...condition, value: e.target.value })}
              />
              {keywords.length > 0 ? <datalist id={listId}>{keywords.map((keyword) => <option key={keyword} value={keyword} />)}</datalist> : null}
            </>
          )}
        </div>
        <button
          type="button"
          aria-label={t('filterRemoveCondition')}
          title={t('filterRemoveCondition')}
          onClick={onRemove}
          className="row-start-2 grid h-9 w-9 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400 @xl:row-start-auto dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-red-400"
        >
          <RemoveIcon />
        </button>
      </div>
    )
  }

  const groupRows = (group: FilterGroup, onChange: (next: FilterGroup) => void, path: string, onRemoveGroup?: () => void) => (
    <div className="grid gap-2">
      {group.filterSet.map((node, index) => {
        const setNode = (next: FilterNode) => onChange({ ...group, filterSet: group.filterSet.map((entry, i) => (i === index ? next : entry)) })
        const remove = () => onChange({ ...group, filterSet: group.filterSet.filter((_, i) => i !== index) })
        return (
          <div key={index} className="flex items-start gap-2">
            {/* Like Teable: "Where" first, the and/or choice on the second row, the same word on all further rows. */}
            <div className="w-20 shrink-0 pt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {index === 0 ? t('filterWhere') : index === 1 ? (
                <Select aria-label={t('filterConjunction')} value={group.conjunction} onChange={(e) => onChange({ ...group, conjunction: e.target.value === 'or' ? 'or' : 'and' })} className="-mt-2 h-9 px-2 text-xs">
                  <option value="and">{t('filterAnd')}</option>
                  <option value="or">{t('filterOr')}</option>
                </Select>
              ) : t(group.conjunction === 'or' ? 'filterOr' : 'filterAnd')}
            </div>
            {isFilterGroup(node) ? (
              <div className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                {groupRows(node, setNode, `${path}-${index}`, remove)}
              </div>
            ) : conditionRow(node, setNode, remove, `${path}-${index}`)}
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...group, filterSet: [...group.filterSet, newCondition()] })}>+ {t('filterCondition')}</Button>
        {onRemoveGroup ? (
          <Button type="button" variant="outline" size="sm" onClick={onRemoveGroup}>{t('filterRemoveGroup')}</Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...group, filterSet: [...group.filterSet, { conjunction: 'and', filterSet: [newCondition()] }] })}>+ {t('filterGroup')}</Button>
        )}
      </div>
    </div>
  )

  return (
    <SettingsGroup level="default">
      <Field label={t('filterRows')} jsonPath="filter" level="default" changed={filter.filterSet.length > 0} onReset={() => patchActiveFrame((f) => ({ ...f, filter: structuredClone(DEFAULT_FRAME.filter) }))} hint={filter.filterSet.length === 0 ? t('filterNone') : undefined}>
        {groupRows(filter, setFilter, 'filter')}
      </Field>
    </SettingsGroup>
  )
}
