import { useEffect } from 'react'
import { useI18n } from '../../uiTranslations'

/** The first rows of the imported sheet, as the backend sends them with the attribution key (`preview`). */
export type DataPreview = { columns: string[]; rows: unknown[][]; total_rows: number }

const cellText = (value: unknown) => (value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value))

/** Table of the imported data of the active dataframe; only shown with a valid attribution key. */
export function DataPreviewDialog({ preview, source, onClose }: { preview: DataPreview; source: string; onClose: () => void }) {
  const { t } = useI18n()
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  const shown = preview.rows.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-preview-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[88svh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white text-left dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 id="data-preview-title" className="m-0 truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('dataPreviewTitle')} · {source}</h2>
            <p className="m-0 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {shown < preview.total_rows
                ? t('dataPreviewSomeRows', { shown, total: preview.total_rows, columns: preview.columns.length })
                : t('dataPreviewAllRows', { total: preview.total_rows, columns: preview.columns.length })}
            </p>
          </div>
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
        {shown === 0 ? (
          <p className="m-0 px-6 py-5 text-sm text-zinc-500 dark:text-zinc-400">{t('dataPreviewEmpty')}</p>
        ) : (
          <div className="min-h-0 overflow-auto">
            <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-20 border-b border-zinc-200 bg-zinc-100 px-2 py-1.5 text-right font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400">#</th>
                  {preview.columns.map((column, index) => (
                    <th key={index} className="sticky top-0 z-10 max-w-64 truncate border-b border-zinc-200 bg-zinc-100 px-2 py-1.5 text-left font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200" title={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="odd:bg-white even:bg-zinc-50 dark:odd:bg-zinc-900 dark:even:bg-zinc-950/60">
                    <td className="sticky left-0 border-b border-zinc-100 bg-inherit px-2 py-1 text-right tabular-nums text-zinc-400 dark:border-zinc-800/60">{rowIndex + 1}</td>
                    {row.map((value, columnIndex) => {
                      const text = cellText(value)
                      return (
                        <td key={columnIndex} className={`max-w-64 truncate border-b border-zinc-100 px-2 py-1 dark:border-zinc-800/60 ${typeof value === 'number' ? 'text-right tabular-nums' : ''}`} title={text}>{text}</td>
                      )
                    })}
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
