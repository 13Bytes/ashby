import type { Translate } from '../uiTranslations'

/** A formatting problem of an Excel sheet, as reported by the backend's check_excel_format(). */
export type ExcelFormatWarning =
  | { code: 'empty_sheet' | 'no_quantities' }
  | { code: 'unnamed_columns' | 'padded_names' | 'duplicate_names'; count: number; columns: string[] }
  | { code: 'incomplete_quantities'; count: number; quantities: Array<{ name: string; missing: string[] }> }
  | { code: 'non_numeric_values'; count: number; columns: Array<{ column: string; count: number; example: string }> }
  | { code: 'low_above_high'; count: number; quantities: Array<{ name: string; count: number }> }

const KNOWN_CODES = new Set(['empty_sheet', 'no_quantities', 'unnamed_columns', 'padded_names', 'duplicate_names', 'incomplete_quantities', 'non_numeric_values', 'low_above_high'])

/** The warnings of an import response; unknown or malformed entries (e.g. from a newer backend) are left out. */
export const parseFormatWarnings = (value: unknown): ExcelFormatWarning[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is ExcelFormatWarning => Boolean(entry) && typeof entry === 'object' && KNOWN_CODES.has((entry as { code?: unknown }).code as string))
    : []

/** Lists the entries, and how many more there are when the backend listed only some of them. */
const list = (entries: string[], total: number, t: Translate) =>
  [...entries, ...(total > entries.length ? [t('fmtMore', { count: total - entries.length })] : [])].join(', ')

/** Column names in quotes, so leading or trailing spaces are visible. */
const quoted = (names: string[]) => names.map((name) => `"${name}"`)

export function describeFormatWarning(warning: ExcelFormatWarning, t: Translate): string {
  switch (warning.code) {
    case 'empty_sheet': return t('fmtEmptySheet')
    case 'no_quantities': return t('fmtNoQuantities')
    case 'unnamed_columns': return t('fmtUnnamedColumns', { columns: list(warning.columns, warning.count, t) })
    case 'padded_names': return t('fmtPaddedNames', { columns: list(quoted(warning.columns), warning.count, t) })
    case 'duplicate_names': return t('fmtDuplicateNames', { columns: list(quoted(warning.columns), warning.count, t) })
    case 'incomplete_quantities':
      return t('fmtIncompleteQuantities', {
        list: list(warning.quantities.map((entry) => `${entry.name} (${t('fmtMissing', { suffixes: entry.missing.join(', ') })})`), warning.count, t),
      })
    case 'non_numeric_values':
      return t('fmtNonNumeric', {
        list: list(warning.columns.map((entry) => `${entry.column} (${t('fmtCells', { count: entry.count, example: entry.example })})`), warning.count, t),
      })
    case 'low_above_high':
      return t('fmtLowAboveHigh', {
        list: list(warning.quantities.map((entry) => `${entry.name} (${entry.count === 1 ? t('fmtRow') : t('fmtRows', { count: entry.count })})`), warning.count, t),
      })
  }
}
