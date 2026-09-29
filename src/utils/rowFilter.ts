/**
 * Row filter of a plot in Teable's format: {"conjunction": "and" | "or", "filterSet": [...]}, a
 * condition being {"fieldId": <column name>, "operator": ..., "value": ...}. The backend applies it
 * to the rows of every source (backend/import_data/filter.py) and ignores incomplete conditions.
 */
export type FilterValue = string | string[] | null
export type FilterCondition = { fieldId: string; operator: string; value: FilterValue }
export type FilterGroup = { conjunction: 'and' | 'or'; filterSet: FilterNode[] }
export type FilterNode = FilterCondition | FilterGroup

export const TEXT_OPERATORS = ['is', 'isNot', 'contains', 'doesNotContain', 'isAnyOf', 'isNoneOf', 'isEmpty', 'isNotEmpty'] as const
export const NUMBER_OPERATORS = ['is', 'isNot', 'isGreater', 'isGreaterEqual', 'isLess', 'isLessEqual', 'isEmpty', 'isNotEmpty'] as const
export type FilterOperator = (typeof TEXT_OPERATORS)[number] | (typeof NUMBER_OPERATORS)[number]
const ALL_OPERATORS: readonly FilterOperator[] = [...new Set<FilterOperator>([...TEXT_OPERATORS, ...NUMBER_OPERATORS])]

const LIST_OPERATORS = new Set(['isAnyOf', 'isNoneOf'])
const NO_VALUE_OPERATORS = new Set(['isEmpty', 'isNotEmpty'])

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
export const isFilterGroup = (node: FilterNode): node is FilterGroup => 'filterSet' in node

const readValue = (value: unknown): FilterValue =>
  Array.isArray(value) ? value.map(String) : value === null || value === undefined ? null : String(value)

const readNode = (node: unknown): FilterNode | null => {
  if (!isRecord(node)) return null
  if (Array.isArray(node.filterSet)) return readFilter(node)
  return { fieldId: typeof node.fieldId === 'string' ? node.fieldId : '', operator: typeof node.operator === 'string' ? node.operator : 'is', value: readValue(node.value) }
}

/** The filter of a config as a group; {} (no filter) is an empty group. */
export function readFilter(value: unknown): FilterGroup {
  if (isRecord(value) && Array.isArray(value.filterSet)) {
    return { conjunction: value.conjunction === 'or' ? 'or' : 'and', filterSet: value.filterSet.map(readNode).filter((node): node is FilterNode => node !== null) }
  }
  const single = isRecord(value) && typeof value.fieldId === 'string' ? readNode(value) : null
  return { conjunction: 'and', filterSet: single ? [single] : [] }
}

/** Back into the config: {} once no condition is left. */
export const writeFilter = (group: FilterGroup): Record<string, unknown> => (group.filterSet.length > 0 ? group : {})

export const newCondition = (fieldId = ''): FilterCondition => ({ fieldId, operator: 'is', value: null })

/** Operators for a column: text columns (with text values) and number columns differ; unknown columns get all. */
export const operatorsFor = (kind: 'text' | 'number' | undefined): readonly FilterOperator[] =>
  kind === 'text' ? TEXT_OPERATORS : kind === 'number' ? NUMBER_OPERATORS : ALL_OPERATORS

export const valueKind = (operator: string): 'none' | 'list' | 'single' =>
  NO_VALUE_OPERATORS.has(operator) ? 'none' : LIST_OPERATORS.has(operator) ? 'list' : 'single'

/** A condition with another operator; the value is kept as far as it fits. */
export function withOperator(condition: FilterCondition, operator: string): FilterCondition {
  const kind = valueKind(operator)
  const values = Array.isArray(condition.value) ? condition.value : condition.value ? [condition.value] : []
  return { ...condition, operator, value: kind === 'none' ? null : kind === 'list' ? values : (values[0] ?? null) }
}

/** Text of a list value in its input ("PC, PET") and back. */
export const formatList = (value: FilterValue) => (Array.isArray(value) ? value.join(', ') : value ?? '')
export const parseList = (text: string) => text.split(',').map((entry) => entry.trim()).filter(Boolean)
