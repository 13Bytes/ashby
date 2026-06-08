import type { ChangeEvent, ReactNode, RefObject } from 'react'
import { Button } from './ui/button'

type AppPopoutsProps = {
  showAbout: boolean
  showSettings: boolean
  showGenerateColorsConfirm: boolean
  showJson: boolean
  showResetConfirm: boolean
  datasourcePrompt: { dataframeIndex: number; filename: string } | null
  jsonFullscreen: boolean
  jsonDraft: string
  jsonHighlightedHtml: string
  settingsContent: ReactNode
  onCloseAbout: () => void
  onCloseSettings: () => void
  onCloseGenerateColorsConfirm: () => void
  onGenerateMaterialColors: () => void
  onToggleJsonFullscreen: () => void
  onCloseJson: () => void
  onJsonDraftChange: (value: string) => void
  onApplyJsonEditor: () => void
  onJsonScroll: (top: number, left: number) => void
  onCloseResetConfirm: () => void
  onConfirmReset: () => void
  onCloseDatasourcePrompt: () => void
  onDatasourcePromptFile: (event: ChangeEvent<HTMLInputElement>) => void
  t: (key: string) => string
  jsonOverlayRef: RefObject<HTMLPreElement | null>
  jsonTextareaRef: RefObject<HTMLTextAreaElement | null>
}

export function AppPopouts(props: AppPopoutsProps) {
  const {
    showAbout, showSettings, showGenerateColorsConfirm, showJson, showResetConfirm, datasourcePrompt, jsonFullscreen, jsonDraft, jsonHighlightedHtml,
    settingsContent, onCloseAbout, onCloseSettings, onCloseGenerateColorsConfirm, onGenerateMaterialColors, onToggleJsonFullscreen,
    onCloseJson, onJsonDraftChange, onApplyJsonEditor, onJsonScroll, onCloseResetConfirm, onConfirmReset, onCloseDatasourcePrompt, onDatasourcePromptFile, t, jsonOverlayRef, jsonTextareaRef,
  } = props

  return (
    <>
      {showAbout ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"><div className="w-full max-w-md rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"><h3 className="mt-0 text-lg">{t('about')}</h3><div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300"><p>{t('aboutIntro')}</p><div><p className="font-medium text-zinc-800 dark:text-zinc-100">{t('credits')}</p><ul className="ml-5 list-disc space-y-1"><li>{t('aboutFoundation')} <a className="underline" href="https://github.com/walgren/Ashby-plots" target="_blank" rel="noreferrer">walgren</a></li><li>{t('aboutRework')} <a className="underline" href="https://aerospace-lab.de/repolysat/" target="_blank" rel="noreferrer">RePloySat</a></li><li>{t('aboutUi')}</li></ul></div></div><div className="mt-4 flex justify-end"><Button variant="outline" onClick={onCloseAbout}>{t('close')}</Button></div></div></div> : null}
      {showSettings ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"><div className="w-full max-w-md rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"><h3 className="mt-0 text-lg">{t('settings')}</h3><div className="grid gap-2">{settingsContent}</div><div className="mt-4 flex justify-end"><Button variant="outline" onClick={onCloseSettings}>{t('close')}</Button></div></div></div> : null}
      {showGenerateColorsConfirm ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"><div className="w-full max-w-md rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"><h3 className="mt-0 text-lg">Generate new material colors?</h3><p className="text-sm text-zinc-600 dark:text-zinc-300">This overwrites all current material colors and spaces hues evenly across all keys.</p><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={onCloseGenerateColorsConfirm}>Cancel</Button><Button onClick={onGenerateMaterialColors}>Yes, generate</Button></div></div></div> : null}
      {showJson ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"><div className={`${jsonFullscreen ? 'h-[96vh] w-[96vw] max-w-none' : 'max-h-[85vh] w-full max-w-4xl'} overflow-hidden rounded-lg border border-zinc-700 bg-white dark:bg-zinc-950`}><div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800"><h3 className="text-sm font-semibold">JSON Editor</h3><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={onToggleJsonFullscreen}>{jsonFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</Button><Button variant="outline" size="sm" onClick={onCloseJson}>{t('close')}</Button></div></div><div className={`${jsonFullscreen ? 'h-[calc(96vh-7.5rem)]' : 'h-[70vh]'} relative`}><pre ref={jsonOverlayRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words bg-white p-3 font-mono text-xs leading-[18px] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100" dangerouslySetInnerHTML={{ __html: jsonHighlightedHtml }} /><textarea ref={jsonTextareaRef} className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent p-3 font-mono text-xs leading-[18px] text-transparent caret-zinc-900 dark:caret-zinc-100" value={jsonDraft} onScroll={(event) => onJsonScroll(event.currentTarget.scrollTop, event.currentTarget.scrollLeft)} onChange={(e) => onJsonDraftChange(e.target.value)} spellCheck={false} /></div><div className="border-t border-zinc-200 p-3 dark:border-zinc-800"><Button size="sm" onClick={onApplyJsonEditor}>Apply JSON</Button></div></div></div> : null}
      {showResetConfirm ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"><div className="w-full max-w-md rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"><h3 className="mt-0 text-lg">Reset configuration?</h3><p className="text-sm text-zinc-600 dark:text-zinc-300">This will replace your current changes with the default config.</p><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={onCloseResetConfirm}>Cancel</Button><Button onClick={onConfirmReset}>Confirm reset</Button></div></div></div> : null}
      {datasourcePrompt ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"><div className="w-full max-w-md rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"><h3 className="mt-0 text-lg">Excel datasource required</h3><p className="text-sm text-zinc-600 dark:text-zinc-300">{`Dataframe ${datasourcePrompt.dataframeIndex + 1} references "${datasourcePrompt.filename}", but that workbook is not available in browser storage. Select the file to continue rendering.`}</p><div className="mt-4 grid gap-3"><input type="file" accept=".xlsx" onChange={onDatasourcePromptFile} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={onCloseDatasourcePrompt}>Cancel</Button></div></div></div></div> : null}
    </>
  )
}
