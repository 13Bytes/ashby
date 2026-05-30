import type { ChangeEvent, RefObject } from 'react'
import type { PlotConfig } from '../config/defaultPlotConfig'
import { exportConfig } from '../utils/configIo'
import { Button } from './ui/button'

type Props = {
  fileInputRef: RefObject<HTMLInputElement | null>
  handleImportFile: (event: ChangeEvent<HTMLInputElement>) => void
  openJsonEditor: () => void
  plotConfig: PlotConfig
  setActivePage: (page: 'config' | 'plot') => void
  setPlotAction: (action: 'preview-current' | 'create-all') => void
  setPlotActionNonce: (patch: (current: number) => number) => void
  setShowAbout: (show: boolean) => void
  setShowMenu: (show: boolean | ((current: boolean) => boolean)) => void
  setShowResetConfirm: (show: boolean) => void
  setShowSettings: (show: boolean) => void
  showMenu: boolean
  t: (key: string) => string
}

export function AppHeader({
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
  const runPlotAction = (action: 'preview-current' | 'create-all') => {
    setPlotAction(action)
    setPlotActionNonce((current) => current + 1)
    setActivePage('plot')
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4 text-left dark:border-zinc-800">
      <div className="flex items-center gap-5 text-sm">
        <h1 className="m-0 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Ashby Plot Builder</h1>
      </div>
      <div className="relative flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setShowMenu((current) => !current)}>Menu</Button>
        <span className="px-2 text-zinc-400">|</span>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>Import</Button>
        <Button type="button" variant="outline" onClick={() => exportConfig(plotConfig)}>Export</Button>
        <Button type="button" variant="outline" onClick={() => setShowResetConfirm(true)}>Reset</Button>
        <span className="px-2 text-zinc-400">|</span>
        <Button type="button" variant="outline" onClick={() => setActivePage('config')}>Config</Button>
        <Button type="button" variant="outline" onClick={openJsonEditor}>{t('json')}</Button>
        <span className="px-2 text-zinc-400">|</span>
        <Button type="button" variant="outline" onClick={() => runPlotAction('preview-current')}>
          Preview one Plot
        </Button>
        <Button type="button" variant="outline" onClick={() => runPlotAction('create-all')}>
          Create all Plots
        </Button>
        {showMenu ? (
          <div className="absolute left-0 top-11 z-40 grid min-w-44 gap-1 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <Button type="button" variant="outline" size="sm" onClick={() => { setShowAbout(true); setShowMenu(false) }}>About</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setShowSettings(true); setShowMenu(false) }}>Settings</Button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
