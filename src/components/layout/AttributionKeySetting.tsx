import { useState } from 'react'
import { useI18n } from '../../uiTranslations'
import { checkAttributionKey, setAttributionKey, useAttributionUnlocked } from '../../utils/attributionKey'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

/** Settings dialog control: enter the attribution key to unlock the copyright and watermark switches. */
export function AttributionKeySetting() {
  const { t } = useI18n()
  const unlocked = useAttributionUnlocked()
  const [draft, setDraft] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unlock = async () => {
    const key = draft.trim()
    if (!key || checking) return
    setChecking(true)
    setError(null)
    try {
      if (await checkAttributionKey(key)) {
        setAttributionKey(key)
        setDraft('')
      } else {
        setError(t('attributionKeyWrong'))
      }
    } catch {
      setError(t('backendUnreachable'))
    } finally {
      setChecking(false)
    }
  }

  if (unlocked) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{t('attributionUnlocked')}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => setAttributionKey(null)}>{t('attributionLock')}</Button>
      </div>
    )
  }
  return (
    <form className="grid justify-items-end gap-1" onSubmit={(event) => { event.preventDefault(); void unlock() }}>
      <div className="flex items-center gap-2">
        <Input
          type="password"
          autoComplete="off"
          className="h-8 w-44"
          aria-label={t('attributionKey')}
          aria-invalid={error !== null}
          placeholder={t('attributionKeyPlaceholder')}
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setError(null) }}
        />
        <Button type="submit" variant="outline" size="sm" disabled={!draft.trim() || checking}>{t('attributionUnlock')}</Button>
      </div>
      {error ? <span role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </form>
  )
}
