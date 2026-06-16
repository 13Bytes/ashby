import { useState, type ChangeEvent, type RefObject } from 'react'
import type { PlotConfig } from '../config/defaultPlotConfig'
import { exportConfig } from '../utils/configIo'
import { Button } from './ui/button'

type Props = {
  activePage: 'config' | 'plot'
  fileInputRef: RefObject<HTMLInputElement | null>
  handleImportFile: (event: ChangeEvent<HTMLInputElement>) => void
  openJsonEditor: () => void
  plotConfig: PlotConfig
  setActivePage: (page: 'config' | 'plot') => void
  setPlotAction: (action: 'preview-current' | 'create-all') => void
  setPlotActionNonce: (patch: (current: number) => number) => void
  setShowAbout: (show: boolean) => void
  setShowMenu:  (show: boolean | ((current: boolean) => boolean)) => void
  setShowResetConfirm: (show: boolean) => void
  setShowSettings: (show: boolean) => void
  showMenu: boolean
  t: (key: string) => string
}

export function AppHeader({
  activePage,
  fileInputRef,
  handleImportFile,
  openJsonEditor,
  plotConfig,
  setActivePage,
  setPlotAction,
  setPlotActionNonce,
  setShowAbout,
  setShowMenu,
  setShowResetConfirm,
  setShowSettings,
  showMenu,
  t,
}: Props) {
  const [showConfigActions, setShowConfigActions] = useState(false)
  const [showPlotActions,   setShowPlotActions  ] = useState(false)

  const runPlotAction = (action: 'preview-current' | 'create-all') => {
    setPlotAction(action)
    setPlotActionNonce((current) => current + 1)
    setActivePage('plot')
    setShowPlotActions(false)
  }

  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-zinc-200 px-4 py-3 text-left dark:border-zinc-800">
      <div className="mr-auto">
        <h1 className="m-0 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Ashby Plot Builder</h1>
      </div>
      <nav className="flex rounded-md border border-zinc-300 p-1 dark:border-zinc-700" aria-label="Application view">
        <Button type="button" variant={activePage === 'config' ? 'default' : 'outline'} className={activePage === 'config' ? '' : 'border-transparent'} onClick={() => setActivePage('config')}>Config</Button>
        <Button type="button" variant={activePage === 'plot'   ? 'default' : 'outline'} className={activePage === 'plot'   ? '' : 'border-transparent'} onClick={() => setActivePage('plot')}  >Plot</Button>
      </nav>
      <div className="relative flex">
        <Button type="button" className="rounded-r-none" onClick={() => runPlotAction('preview-current')}>
          Generate plot
        </Button>
        <Button type="button" className="rounded-l-none border-l border-violet-400 px-3" aria-label="Choose plot action" aria-haspopup="menu" aria-expanded={showPlotActions} onClick={() => { setShowPlotActions((current) => !current); setShowConfigActions(false); setShowMenu(false) }}>
          <span className="text-xs" aria-hidden="true">▼</span>
        </Button>
        {showPlotActions ? (
          <div className="absolute right-0 top-11 z-40 grid min-w-48 gap-1 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900" role="menu">
            <Button type="button" variant="outline" size="sm" onClick={() => runPlotAction('preview-current')}>Generate current plot</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => runPlotAction('create-all')}     >Generate all plots</Button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
        <div className="relative">
          <Button type="button" variant="outline" aria-haspopup="menu" aria-expanded={showConfigActions} onClick={() => { setShowConfigActions((current) => !current); setShowPlotActions(false); setShowMenu(false) }}>
            Config actions <span className="ml-2 text-xs" aria-hidden="true">▼</span>
          </Button>
          {showConfigActions ? (
            <div className="absolute right-0 top-11 z-40 grid min-w-48 gap-1 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900" role="menu">
              <Button type="button" variant="outline" size="sm" onClick={() => { fileInputRef.current?.click(); setShowConfigActions(false) }}>Import config</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { exportConfig(plotConfig);      setShowConfigActions(false) }}>Export config</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { openJsonEditor();              setShowConfigActions(false) }}>{t('json')}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowResetConfirm(true);     setShowConfigActions(false) }}>Reset config</Button>
            </div>
          ) : null}
        </div>

        <div className="relative">
          <Button type="button" variant="outline" aria-haspopup="menu" aria-expanded={showMenu} onClick={() => { setShowMenu((current) => !current); setShowConfigActions(false); setShowPlotActions(false) }}>More <span className="ml-2 text-xs" aria-hidden="true">▼</span></Button>
          {showMenu ? (
            <div className="absolute right-0 top-11 z-40 grid min-w-44 gap-1 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900" role="menu">
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowSettings(true); setShowMenu(false) }}>Settings</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowAbout(true);    setShowMenu(false) }}>About</Button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
