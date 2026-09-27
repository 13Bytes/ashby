import { useRef, useState, type ReactNode } from 'react'
import { SETTINGS_SECTIONS, type SettingsSectionId } from '../config/settingsSections'
import { useSectionStats, type SectionStats } from '../hooks/useSectionStats'
import { useI18n } from '../uiTranslations'
import { useSettings } from '../utils/settingsContext'

type Props = {
  id: SettingsSectionId
  /** Hidden while another section is shown on its own. */
  hidden: boolean
  showDefaults: boolean
  onToggleDefaults: (id: SettingsSectionId) => void
  children: ReactNode
}

/**
 * One settings section of the editor, shown on its own or in the scrolling column of all sections.
 * In Simple mode it offers to show the settings that can stay at their defaults.
 */
export function SettingsSection({ id, hidden, showDefaults, onToggleDefaults, children }: Props) {
  const { t } = useI18n()
  const { mode } = useSettings()
  const section = SETTINGS_SECTIONS.find((entry) => entry.id === id)!
  const ref = useRef<HTMLElement | null>(null)
  const [stats, setStats] = useState<SectionStats>({ defaults: 0, essentials: 1 })
  useSectionStats(ref, (next) => {
    if (next.defaults === stats.defaults && next.essentials === stats.essentials) return
    setStats(next)
  })
  const simple = mode === 'simple'

  return (
    <section ref={ref} data-section-id={id} hidden={hidden} className={`grid min-w-0 scroll-mt-5 grid-cols-[minmax(0,1fr)] content-start gap-5 ${showDefaults ? 'show-defaults' : ''}`}>
      <header className="grid gap-1">
        <h2 className="m-0 text-lg font-semibold tracking-tight">{t(section.titleKey)}</h2>
        <p className="m-0 max-w-prose text-sm text-zinc-500 dark:text-zinc-400">{t(section.introKey)}</p>
      </header>
      {children}
      {simple && stats.essentials === 0 && !showDefaults ? (
        <p className="m-0 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {t('allDefaultsNote')}
        </p>
      ) : null}
      {simple && stats.defaults > 0 ? (
        <button
          type="button"
          onClick={() => onToggleDefaults(id)}
          aria-expanded={showDefaults}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-300 px-3.5 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {showDefaults ? t('hideDefaults') : t('showDefaults', { count: stats.defaults })}
        </button>
      ) : null}
    </section>
  )
}
