import { useCallback, useState, type ReactNode } from 'react'
import type { SettingsMode } from '../../config/settingsSections'
import { useI18n } from '../../uiTranslations'
import { Toggle } from '../common/AppControls'
import { BrandLogo } from '../common/BrandLogo'
import { DebugLogDialog } from './DebugLog'

type Props = {
  mode: SettingsMode
  setMode: (mode: SettingsMode) => void
  openJsonEditor: () => void
  setShowAbout: (show: boolean) => void
  setShowSettings: (show: boolean) => void
  showOverview: boolean
  onShowOverview: () => void
}

const iconProps = { viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', className: 'h-[18px] w-[18px]', 'aria-hidden': true } as const

const CogIcon = () => (
  <svg {...iconProps}>
    <path d="M8.6 2.5h2.8l.4 2.1 1.5.9 2-.8 1.4 2.4-1.6 1.4v1.8l1.6 1.4-1.4 2.4-2-.8-1.5.9-.4 2.1H8.6l-.4-2.1-1.5-.9-2 .8-1.4-2.4 1.6-1.4V9.1L3.3 7.7l1.4-2.4 2 .8 1.5-.9z" />
    <circle cx="10" cy="10" r="2.4" />
  </svg>
)
const JsonIcon = () => (
  <svg {...iconProps}>
    <path d="M7 3.5c-1.6 0-2 .8-2 2v2.2c0 1-.6 1.8-1.6 2.3 1 .5 1.6 1.3 1.6 2.3v2.2c0 1.2.4 2 2 2" />
    <path d="M13 3.5c1.6 0 2 .8 2 2v2.2c0 1 .6 1.8 1.6 2.3-1 .5-1.6 1.3-1.6 2.3v2.2c0 1.2-.4 2-2 2" />
  </svg>
)
const LogIcon = () => (
  <svg {...iconProps}>
    <rect x="4" y="2.5" width="12" height="15" rx="1.5" />
    <path d="M7 6.5h6M7 9.5h6M7 12.5h4" />
  </svg>
)
const InfoIcon = () => (
  <svg {...iconProps}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 9v4.5" />
    <circle cx="10" cy="6.2" r=".6" fill="currentColor" />
  </svg>
)

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-full w-9 place-items-center text-zinc-600 hover:bg-zinc-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-brand-300"
    >
      {children}
    </button>
  )
}

export function AppHeader({ mode, setMode, openJsonEditor, setShowAbout, setShowSettings, showOverview, onShowOverview }: Props) {
  const { t } = useI18n()
  const [showLog, setShowLog] = useState(false)
  const closeLog = useCallback(() => setShowLog(false), [])

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-2 text-left dark:border-zinc-800">
      <h1 className="m-0 mr-auto text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {/* The logo leads back to the overview. */}
        <button
          type="button"
          onClick={onShowOverview}
          title={t('backToOverview')}
          aria-label={`PolyPlot – ${t('backToOverview')}`}
          className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-0.5 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:text-brand-300"
        >
          <BrandLogo className="h-6 w-6" />
          PolyPlot
        </button>
      </h1>
      {showOverview ? null : (
        <span title={t('modeHint')} className="flex">
          <Toggle<SettingsMode>
            ariaLabel={t('modeHint')}
            value={mode}
            onChange={setMode}
            options={[{ value: 'simple', label: t('modeSimple') }, { value: 'all', label: t('modeAll') }]}
          />
        </span>
      )}
      <div role="group" aria-label={t('menu')} className="flex h-9 divide-x divide-zinc-300 overflow-hidden rounded-md border border-zinc-300 dark:divide-zinc-700 dark:border-zinc-700">
        <IconButton label={t('settings')} onClick={() => setShowSettings(true)}><CogIcon /></IconButton>
        <IconButton label={t('editJson')} onClick={openJsonEditor}><JsonIcon /></IconButton>
        <IconButton label={t('openLog')} onClick={() => setShowLog(true)}><LogIcon /></IconButton>
        <IconButton label={t('about')} onClick={() => setShowAbout(true)}><InfoIcon /></IconButton>
      </div>
      {showLog ? <DebugLogDialog onClose={closeLog} /> : null}
    </header>
  )
}
