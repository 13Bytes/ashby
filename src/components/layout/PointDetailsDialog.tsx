import { useEffect } from 'react'
import { useI18n } from '../../uiTranslations'
import type { PlotPoint } from '../../hooks/usePlotImages'
import { useAttributionUnlocked } from '../../utils/attributionKey'

const hasValue = (value: unknown) => value !== null && value !== undefined && value !== ''
const cellText = (value: unknown) => (typeof value === 'object' ? JSON.stringify(value) : String(value))

/** One displayed row of the details table: a plain column, or a merged "low - high unit" quantity. */
type DisplayRow = { key: string; text: string }

/**
 * Data columns follow the sheet's own "<name> low" / "<name> high" / "<name> unit" convention (see
 * backend/import_data/import_data.py, RANGE_SUFFIXES). Merges those three into one "low - high unit"
 * row (the "- high" part only when a high value exists) instead of listing them separately, and drops
 * quantities where neither low nor high has a value. The "URL" column (a link to the manufacturer's
 * datasheet) is left out unless the attribution key is unlocked, same as the data preview dialog.
 */
function toDisplayRows(row: Record<string, unknown>, attributionUnlocked: boolean): DisplayRow[] {
  const consumed = new Set<string>()
  const rows: DisplayRow[] = []
  for (const key of Object.keys(row)) {
    if (consumed.has(key)) continue
    if (!attributionUnlocked && key.trim().toLowerCase() === 'url') continue
    const suffix = (['low', 'high', 'unit'] as const).find((candidate) => key.endsWith(` ${candidate}`))
    if (!suffix) {
      if (hasValue(row[key])) rows.push({ key, text: cellText(row[key]) })
      continue
    }
    const base = key.slice(0, -(suffix.length + 1))
    const low = row[`${base} low`]
    const high = row[`${base} high`]
    const unit = row[`${base} unit`]
    consumed.add(`${base} low`).add(`${base} high`).add(`${base} unit`)
    if (!hasValue(low) && !hasValue(high)) continue
    let text = hasValue(low) ? cellText(low) : cellText(high)
    if (hasValue(low) && hasValue(high) && cellText(high) !== cellText(low)) text += ` - ${cellText(high)}`
    if (hasValue(unit)) text += ` ${cellText(unit)}`
    rows.push({ key: base, text })
  }
  return rows
}

/** Details of one clicked point of the plot preview: its label and its full underlying data row. */
export function PointDetailsDialog({ point, onClose }: { point: PlotPoint; onClose: () => void }) {
  const { t } = useI18n()
  const attributionUnlocked = useAttributionUnlocked()
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  const rowEntries = point.row ? toDisplayRows(point.row, attributionUnlocked) : []
  const title = point.hierarchy.filter(Boolean).join(', ') || point.label.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="point-details-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[88svh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white text-left dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 id="point-details-title" className="m-0 truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title || t('pointDetailsTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            title={t('close')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-lg leading-none text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            ×
          </button>
        </div>
        {rowEntries.length === 0 ? (
          <p className="m-0 px-6 py-5 text-sm text-zinc-500 dark:text-zinc-400">{t('pointDetailsEmpty')}</p>
        ) : (
          <div className="min-h-0 overflow-auto">
            <table className="w-full table-fixed border-separate border-spacing-0 text-xs">
              <colgroup>
                <col className="w-[42%]" />
                <col />
              </colgroup>
              <tbody>
                {rowEntries.map(({ key, text }, index) => (
                  <tr key={key} className="odd:bg-white even:bg-zinc-50 dark:odd:bg-zinc-900 dark:even:bg-zinc-950/60">
                    <th scope="row" className={`break-words border-b border-zinc-100 px-3 py-1 text-right align-top font-medium text-zinc-500 dark:border-zinc-800/60 dark:text-zinc-400 ${index === 0 ? 'border-t border-zinc-100 dark:border-zinc-800/60' : ''}`}>{key}</th>
                    <td className={`break-words border-b border-zinc-100 px-3 py-1 text-zinc-900 dark:border-zinc-800/60 dark:text-zinc-100 ${index === 0 ? 'border-t border-zinc-100 dark:border-zinc-800/60' : ''}`}>{text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
