import { useEffect } from 'react'
import { PRIVACY_CONTENT } from '../../content/privacyContent'
import { useI18n } from '../../uiTranslations'
import { RichText } from '../common/RichText'

export function PrivacyDialog({ onClose }: { onClose: () => void }) {
  const { language, t } = useI18n()
  const content = PRIVACY_CONTENT[language]
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[88svh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white text-left dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 id="privacy-title" className="m-0 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{content.title}</h2>
            <p className="m-0 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{content.updated}</p>
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
        <div className="overflow-y-auto px-6 py-5">
          <ul className="m-0 grid list-none gap-1.5 rounded-lg bg-brand-50 p-4 text-sm font-medium text-brand-900 dark:bg-brand-950/50 dark:text-brand-100">
            {content.summary.map((line) => <li key={line}>✓ {line}</li>)}
          </ul>
          {content.sections.map((section) => (
            <section key={section.heading} className="mt-6">
              <h3 className="m-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{section.heading}</h3>
              <div className="mt-1.5 grid gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                {section.paragraphs.map((parts, index) => <p key={index} className="m-0"><RichText parts={parts} /></p>)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
