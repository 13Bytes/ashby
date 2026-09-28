import type { Translate } from '../uiTranslations'

/**
 * A problem of an Excel sheet that keeps data out of the plot, as reported by the backend's
 * check_excel_format(). Harmless quirks (spaces around names, decimal commas, unit columns) are
 * handled by the backend and not reported.
 */
export type ExcelFormatWarning =
  | { code: 'empty_sheet' | 'no_quantities' }
  | { code: 'incomplete_quantities'; count: number; quantities: Array<{ name: string; missing: string[] }> }
  | { code: 'non_numeric_values'; count: number; columns: Array<{ column: string; count: number; example: string }> }

const KNOWN_CODES = new Set(['empty_sheet', 'no_quantities', 'incomplete_quantities', 'non_numeric_values'])

/** The warnings of an import response; unknown or malformed entries (e.g. from another backend version) are left out. */
export const parseFormatWarnings = (value: unknown): ExcelFormatWarning[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is ExcelFormatWarning => Boolean(entry) && typeof entry === 'object' && KNOWN_CODES.has((entry as { code?: unknown }).code as string))
    : []

/** Lists the entries, and how many more there are when the backend listed only some of them. */
const list = (entries: string[], total: number, t: Translate) =>
  [...entries, ...(total > entries.length ? [t('fmtMore', { count: total - entries.length })] : [])].join(', ')

export function describeFormatWarning(warning: ExcelFormatWarning, t: Translate): string {
  switch (warning.code) {
    case 'empty_sheet': return t('fmtEmptySheet')
    case 'no_quantities': return t('fmtNoQuantities')
    case 'incomplete_quantities':
      return t('fmtIncompleteQuantities', {
        list: list(warning.quantities.map((entry) => `${entry.name} (${t('fmtMissing', { suffixes: entry.missing.join(', ') })})`), warning.count, t),
      })
    case 'non_numeric_values':
      return t('fmtNonNumeric', {
        list: list(warning.columns.map((entry) => `${entry.column} (${t('fmtCells', { count: entry.count, example: entry.example })})`), warning.count, t),
      })
  }
}
