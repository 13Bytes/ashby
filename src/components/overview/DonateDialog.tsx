import { useEffect, useState } from 'react'
import { DONATION_ACCOUNT, OVERVIEW_CONTENT } from '../../content/overviewContent'
import { useI18n } from '../../uiTranslations'
import { RichText } from '../common/RichText'

/** One line of the bank details; IBAN and reference can be copied. */
function AccountRow({ label, value, copyValue, note }: { label: string; value: string; copyValue?: string; note?: string }) {
  const { language } = useI18n()
  const content = OVERVIEW_CONTENT[language]
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <div className="grid gap-0.5 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs font-medium text-zinc-500 sm:pt-0.5 dark:text-zinc-400">{label}</dt>
      <dd className="m-0 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-zinc-900 select-all dark:text-zinc-100">{value}</span>
        {note ? <span className="text-zinc-500 dark:text-zinc-400">{note}</span> : null}
        {copyValue ? (
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(copyValue).then(() => setCopied(true), () => {}) }}
            className="ml-auto rounded-md border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:border-brand-400 hover:text-brand-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-brand-300"
          >
            {copied ? `✓ ${content.copied}` : content.copy}
          </button>
        ) : null}
      </dd>
    </div>
  )
}

/** Bank details for donations to the Aerospace Lab, shown from the overview page. */
export function DonateDialog({ onClose }: { onClose: () => void }) {
  const { language, t } = useI18n()
  const content = OVERVIEW_CONTENT[language]
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
        aria-labelledby="donate-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[88svh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white text-left dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 id="donate-title" className="m-0 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{content.donateTitle}</h2>
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
        <div className="grid gap-4 overflow-y-auto px-6 py-5 text-sm text-zinc-600 dark:text-zinc-400">
          <p className="m-0">{content.donateDialogText}</p>
          <dl className="m-0 divide-y divide-zinc-200 rounded-lg border border-zinc-200 px-4 dark:divide-zinc-800 dark:border-zinc-800">
            <AccountRow label={content.donateRecipient} value={DONATION_ACCOUNT.recipient} copyValue={DONATION_ACCOUNT.recipient}/>
            <AccountRow label="IBAN" value={DONATION_ACCOUNT.iban} copyValue={DONATION_ACCOUNT.iban.replaceAll(' ', '')} />
            <AccountRow label="BIC" value={DONATION_ACCOUNT.bic} copyValue={DONATION_ACCOUNT.bic}/>
            <AccountRow label={content.donateBank} value={DONATION_ACCOUNT.bank} copyValue={DONATION_ACCOUNT.bank}/>
            <AccountRow label={content.donateReference} value={DONATION_ACCOUNT.reference} copyValue={DONATION_ACCOUNT.reference} />
          </dl>
          <p className="m-0 text-xs text-zinc-500"><RichText parts={content.donateSource} /></p>
        </div>
      </div>
    </div>
  )
}
