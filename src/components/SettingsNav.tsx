import { useState, type RefObject } from 'react'
import { SETTINGS_SECTIONS, isHiddenInMode, isSettingsSectionId, type SettingsMode, type SettingsSectionId } from '../config/settingsSections'
import { useI18n } from '../uiTranslations'
import { HoverNote, ScopeTag } from './AppControls'

/** Sidebar status of a section: missing required settings, or the number of items it holds. */
export type SectionStatus = { missing: number; items?: number }

type SearchHit = { label: string; section: SettingsSectionId; element: HTMLElement; hidden: boolean }

type Props = {
  mode: SettingsMode
  activeSection: SettingsSectionId
  onSelect: (section: SettingsSectionId) => void
  /** Jumps to a field found by the search. */
  onReveal: (section: SettingsSectionId, element: HTMLElement) => void
  statusFor: (section: SettingsSectionId) => SectionStatus
  dataframeName: string
  frameName: string
  editorRef: RefObject<HTMLElement | null>
}

/** Settings list: search, the shared dataset sections and the sections of the active plot. */
export function SettingsNav({ mode, activeSection, onSelect, onReveal, statusFor, dataframeName, frameName, editorRef }: Props) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const normalized = query.trim().toLowerCase()

  // Searches the rendered fields, so hidden defaults and collapsed items are found too.
  const search = (text: string) => {
    setQuery(text)
    const needle = text.trim().toLowerCase()
    const next: SearchHit[] = []
    if (needle && editorRef.current) {
      const seen = new Set<string>()
      for (const element of editorRef.current.querySelectorAll<HTMLElement>('[data-setting]')) {
        const label = element.dataset.setting ?? ''
        const sectionId = element.closest<HTMLElement>('[data-section-id]')?.dataset.sectionId ?? ''
        if (!label.toLowerCase().includes(needle) || !isSettingsSectionId(sectionId)) continue
        const key = `${sectionId}|${label}`
        if (seen.has(key)) continue
        seen.add(key)
        next.push({ label, section: sectionId, element, hidden: mode === 'simple' && (isHiddenInMode(sectionId, mode) || Boolean(element.closest('[data-level="default"]'))) })
        if (next.length >= 12) break
      }
    }
    setHits(next)
  }

  const renderStatus = (status: SectionStatus) => {
    if (status.missing > 0) return <span className="ml-auto rounded-full bg-orange-600 px-1.5 text-[10px] font-bold text-white">{status.missing}</span>
    if (status.items !== undefined && status.items > 0) return <span className="ml-auto text-[11px] tabular-nums text-zinc-400">{status.items}</span>
    return null
  }

  const group = (scope: 'dataset' | 'plot') => (
    <ul className="m-0 grid list-none gap-px p-0">
      {SETTINGS_SECTIONS.filter((section) => section.scope === scope).map((section) => {
        const active = section.id === activeSection
        if (isHiddenInMode(section.id, mode)) {
          // Not clickable in Simple mode; hovering or focusing it explains why.
          return (
            <li key={section.id}>
              <HoverNote note={t('sectionAllSettingsOnly', { section: t(section.titleKey) })}>
                <span
                  tabIndex={0}
                  aria-disabled="true"
                  className="flex w-full cursor-not-allowed items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400 dark:text-zinc-600"
                >
                  <span className="min-w-0">{t(section.titleKey)}</span>
                  <span className="ml-auto shrink-0 rounded border border-dashed border-zinc-300 px-1 text-[10px] leading-4 dark:border-zinc-700">{t('allSettingsBadge')}</span>
                </span>
              </HoverNote>
            </li>
          )
        }
        return (
          <li key={section.id}>
            <button
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => onSelect(section.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${active
                ? scope === 'dataset'
                  ? 'bg-violet-100 font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-200'
                  : 'bg-brand-100 font-semibold text-brand-900 dark:bg-brand-950 dark:text-brand-200'
                : 'text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}
            >
              <span className="min-w-0">{t(section.titleKey)}</span>
              {renderStatus(statusFor(section.id))}
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <nav aria-label={t('settings')} className="flex min-h-0 flex-col gap-4 overflow-auto border-r border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <input
        type="search"
        value={query}
        onChange={(event) => search(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Escape') search('') }}
        placeholder={t('findSetting')}
        aria-label={t('findSetting')}
        className="h-8 w-full rounded-md border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
      {normalized ? (
        <ul className="m-0 grid list-none gap-px p-0">
          {hits.length === 0 ? <li className="px-2 py-1 text-xs text-zinc-500">{t('noSettingMatch', { query: query.trim() })}</li> : null}
          {hits.map((hit) => (
            <li key={`${hit.section}|${hit.label}`}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
                onClick={() => {
                  search('')
                  onReveal(hit.section, hit.element)
                }}
              >
                <span className="min-w-0 truncate">{hit.label}</span>
                <span className="ml-auto shrink-0 text-[10px] text-zinc-400">
                  {t(SETTINGS_SECTIONS.find((section) => section.id === hit.section)!.titleKey)}{hit.hidden ? ` · ${t('hiddenSuffix')}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="grid gap-1 border-l-[3px] border-violet-500 pl-2.5">
            <ScopeTag scope="dataset">{t('datasetShared')}</ScopeTag>
            <strong className="truncate text-xs" title={dataframeName}>{dataframeName}</strong>
            {group('dataset')}
          </div>
          <div className="grid gap-1 border-l-[3px] border-brand-500 pl-2.5">
            <ScopeTag scope="plot">{t('plotOnly')}</ScopeTag>
            <strong className="truncate text-xs" title={frameName}>{frameName}</strong>
            {group('plot')}
          </div>
        </>
      )}
    </nav>
  )
}
