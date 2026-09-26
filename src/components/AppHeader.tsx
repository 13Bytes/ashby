import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from 'react'
import type { PlotConfig } from '../config/defaultPlotConfig'
import { useI18n } from '../uiTranslations'
import { exportConfig } from '../utils/configIo'
import { Button } from './ui/button'

type Props = {
  activePage: 'config' | 'plot'
  configBaseName: string
  fileInputRef: RefObject<HTMLInputElement | null>
  handleImportFile: (event: ChangeEvent<HTMLInputElement>) => void
  openJsonEditor: () => void
  plotConfig: PlotConfig
  setActivePage: (page: 'config' | 'plot') => void
  setPlotAction: (action: 'preview-current' | 'create-all') => void
  setPlotActionNonce: (patch: (current: number) => number) => void
  setShowAbout: (show: boolean) => void
  setShowResetConfirm: (show: boolean) => void
  setShowSettings: (show: boolean) => void
}

type OpenMenu = 'plot' | 'config' | 'more' | null

const menuClassName = 'absolute right-0 top-11 z-40 grid min-w-48 gap-1 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900'

export function AppHeader({
  activePage,
  configBaseName,
  fileInputRef,
  handleImportFile,
  openJsonEditor,
  plotConfig,
  setActivePage,
  setPlotAction,
  setPlotActionNonce,
  setShowAbout,
  setShowResetConfirm,
  setShowSettings,
}: Props) {
  const { t } = useI18n()
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  const menusRef = useRef<HTMLDivElement | null>(null)

  // Close the open dropdown on a click outside the menus or on Escape.
  useEffect(() => {
    if (!openMenu) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!menusRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openMenu])

  const toggleMenu = (menu: Exclude<OpenMenu, null>) => setOpenMenu((current) => (current === menu ? null : menu))
  const runMenuAction = (action: () => void) => {
    action()
    setOpenMenu(null)
  }
  const runPlotAction = (action: 'preview-current' | 'create-all') => {
    setPlotAction(action)
    setPlotActionNonce((current) => current + 1)
    setActivePage('plot')
    setOpenMenu(null)
  }

  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-zinc-200 py-3 text-left dark:border-zinc-800">
      <div className="mr-auto">
        <h1 className="m-0 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Ashby Plot Builder</h1>
      </div>
      <nav className="flex rounded-md border border-zinc-300 p-1 dark:border-zinc-700" aria-label={t('applicationView')}>
        <Button type="button" variant={activePage === 'config' ? 'default' : 'outline'} className={activePage === 'config' ? '' : 'border-transparent'} onClick={() => setActivePage('config')}>{t('config')}</Button>
        <Button type="button" variant={activePage === 'plot' ? 'default' : 'outline'} className={activePage === 'plot' ? '' : 'border-transparent'} onClick={() => { setPlotAction('preview-current'); setActivePage('plot') }}>{t('plot')}</Button>
      </nav>
      <div ref={menusRef} className="flex flex-wrap items-center gap-4">
        <div className="relative flex">
          <Button type="button" className="rounded-r-none" onClick={() => runPlotAction('preview-current')}>      {/* & remember dropdown selection */}
            {t('generatePlot')}
          </Button>
          <Button type="button" className="rounded-l-none border-l border-violet-400 px-3" aria-label={t('choosePlotAction')} aria-haspopup="menu" aria-expanded={openMenu === 'plot'} onClick={() => toggleMenu('plot')}>
            <span className="text-xs" aria-hidden="true">▼</span>
          </Button>
          {openMenu === 'plot' ? (
            <div className={menuClassName} role="menu">
              <Button type="button" variant="outline" size="sm" onClick={() => runPlotAction('preview-current')}>{t('generateCurrentPlot')}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => runPlotAction('create-all')}>{t('generateAllPlots')}</Button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          <div className="relative">
            <Button type="button" variant="outline" aria-haspopup="menu" aria-expanded={openMenu === 'config'} onClick={() => toggleMenu('config')}>
              {t('configActions')} <span className="ml-2 text-xs" aria-hidden="true">▼</span>
            </Button>
            {openMenu === 'config' ? (
              <div className={menuClassName} role="menu">
                <Button type="button" variant="outline" size="sm" onClick={() => runMenuAction(() => fileInputRef.current?.click())}>{t('importConfig')}</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runMenuAction(() => exportConfig(plotConfig, configBaseName))}>{t('exportConfig')}</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runMenuAction(openJsonEditor)}>{t('json')}</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runMenuAction(() => setShowResetConfirm(true))}>{t('resetConfig')}</Button>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <Button type="button" variant="outline" aria-haspopup="menu" aria-expanded={openMenu === 'more'} onClick={() => toggleMenu('more')}>
              {t('more')} <span className="ml-2 text-xs" aria-hidden="true">▼</span>
            </Button>
            {openMenu === 'more' ? (
              <div className={menuClassName} role="menu">
                <Button type="button" variant="outline" size="sm" onClick={() => runMenuAction(() => setShowSettings(true))}>{t('settings')}</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runMenuAction(() => setShowAbout(true))}>{t('about')}</Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
