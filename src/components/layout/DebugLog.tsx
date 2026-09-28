import { useEffect, useState } from 'react'
import { useI18n } from '../../uiTranslations'
import type { BackendErrorDetails } from '../../utils/backendErrors'
import { downloadBlob } from '../../utils/configIo'
import { clearLog, formatLogEntry, formatLogTime, useDebugLog, type DebugLogEntry, type LogLevel } from '../../utils/debugLog'
import { Alert } from '../ui/alert'
import { Button } from '../ui/button'

function CopyButton({ text }: { text: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timeout)
  }, [copied])
  return (
    <button
      type="button"
      className="rounded border border-current/20 px-2 py-0.5 text-[11px] opacity-80 hover:opacity-100"
      onClick={() => { void navigator.clipboard?.writeText(text).then(() => setCopied(true)) }}
    >
      {copied ? t('copied') : t('copy')}
    </button>
  )
}

/** Monospace block for tracebacks and logs, scrollable, with a copy button. */
function LogBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold">
        <span>{title}</span>
        <CopyButton text={text} />
      </div>
      <pre className="m-0 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-zinc-950 p-2 font-mono text-[11px] leading-relaxed text-zinc-100">{text}</pre>
    </div>
  )
}

/** Message, location, warnings and the collapsible technical details of an error or log entry. */
function DetailsBody({ details }: { details: Pick<BackendErrorDetails, 'message' | 'location' | 'messages' | 'traceback' | 'log'> }) {
  const { t } = useI18n()
  const hasTechnicalDetails = Boolean(details.traceback || details.log)
  return (
    <div className="grid gap-2">
      {details.message ? <p className="m-0 break-words font-mono text-sm">{details.message}</p> : null}
      {details.location ? (
        <p className="m-0 text-xs">
          <span className="font-semibold">{t('errorLocation')}:</span> <code className="break-all">{details.location}</code>
        </p>
      ) : null}
      {details.messages.length > 0 ? (
        <div className="text-xs">
          <span className="font-semibold">{t('plotMessages')}:</span>
          <ul className="m-0 mt-1 list-disc pl-5">
            {details.messages.map((message, index) => <li key={index} className="break-words">{message}</li>)}
          </ul>
        </div>
      ) : null}
      {hasTechnicalDetails ? (
        <details className="text-xs">
          <summary className="cursor-pointer select-none font-semibold">{t('showDetails')}</summary>
          <div className="mt-2 grid gap-3">
            {details.traceback ? <LogBlock title={t('traceback')} text={details.traceback} /> : null}
            {details.log ? <LogBlock title={t('backendOutput')} text={details.log} /> : null}
          </div>
        </details>
      ) : null}
    </div>
  )
}

/** Error box with everything the backend reported about a failure. */
export function ErrorDetails({ title, details }: { title: string; details: BackendErrorDetails }) {
  return (
    <Alert variant="destructive">
      <div className="grid gap-2">
        <strong>{title}</strong>
        <DetailsBody details={details} />
      </div>
    </Alert>
  )
}

const levelClassName: Record<LogLevel, string> = {
  info: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
}

function LogEntryItem({ entry }: { entry: DebugLogEntry }) {
  const { t } = useI18n()
  const sourceLabel = { render: t('logSourceRender'), download: t('logSourceDownload'), import: t('logSourceImport'), config: t('logSourceConfig') }[entry.source]
  return (
    <details className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
      <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 text-sm">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${levelClassName[entry.level]}`}>{entry.level}</span>
        <span className="font-mono text-xs text-zinc-500">{formatLogTime(entry.time)}</span>
        <span className="text-xs text-zinc-500">{sourceLabel}</span>
        <span className="font-medium">{entry.title}</span>
        {entry.durationMs !== undefined ? <span className="text-xs text-zinc-500">{t('durationMs', { ms: entry.durationMs })}</span> : null}
        {entry.status !== undefined ? <span className="text-xs text-zinc-500">HTTP {entry.status}</span> : null}
      </summary>
      <div className="mt-2 grid gap-2">
        <DetailsBody details={{ message: entry.message ?? '', location: entry.location, messages: entry.messages ?? [], traceback: entry.traceback, log: entry.log }} />
        <div><CopyButton text={formatLogEntry(entry)} /></div>
      </div>
    </details>
  )
}

/** Log of all backend interactions (renders, imports, downloads). */
export function DebugLogDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const logState = useDebugLog()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const downloadLog = () => {
    const text = logState.entries.map(formatLogEntry).join('\n\n' + '-'.repeat(80) + '\n\n')
    downloadBlob(new Blob([text], { type: 'text/plain' }), `ashby-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`)
  }

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('logTitle')}
            className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg border border-zinc-300 bg-white text-left dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h3 className="m-0 text-base font-semibold">{t('logTitle')}</h3>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={downloadLog} disabled={logState.entries.length === 0}>{t('downloadLog')}</Button>
                <Button type="button" size="sm" variant="outline" onClick={clearLog} disabled={logState.entries.length === 0}>{t('clearLog')}</Button>
                <Button type="button" size="sm" variant="outline" onClick={onClose}>{t('close')}</Button>
              </div>
            </div>
            <div className="grid gap-2 overflow-auto p-4">
              {logState.entries.length === 0 ? <p className="m-0 text-sm text-zinc-500">{t('logEmpty')}</p> : null}
              {logState.entries.map((entry) => <LogEntryItem key={entry.id} entry={entry} />)}
            </div>
          </div>
        </div>
  )
}
