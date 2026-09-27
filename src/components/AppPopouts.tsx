import { useEffect, type ChangeEvent, type ReactNode, type RefObject } from 'react'
import { cn } from '../lib/utils'
import { useI18n } from '../uiTranslations'
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
  jsonMarker: Set<number>
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
  jsonOverlayRef: RefObject<HTMLPreElement | null>
  jsonTextareaRef: RefObject<HTMLTextAreaElement | null>
}

type PopoutShellProps = {
  children: ReactNode
  panelClassName?: string
}

type JsonTokenMode = 'plain' | 'string' | 'number' | 'keyword'

const popoutPanelClassName =
  'w-full max-w-md rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900'

const linkClassName = 'underline'

function PopoutShell({ children, panelClassName }: PopoutShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className={cn(popoutPanelClassName, panelClassName)}>{children}</div>
    </div>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className={linkClassName} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

function DialogActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-4 flex justify-end gap-2', className)}>{children}</div>
}

function highlightedTokenClassName(mode: JsonTokenMode) {
  if (mode === 'string') return 'text-emerald-700 dark:text-emerald-400'
  if (mode === 'number') return 'text-sky-700 dark:text-sky-400'
  if (mode === 'keyword') return 'text-fuchsia-700 dark:text-fuchsia-400'
  return undefined
}

function getTokenMode(char: string): JsonTokenMode {
  if (/[0-9-]/.test(char)) return 'number'
  if (/[A-Za-z]/.test(char)) return 'keyword'
  return 'plain'
}

function renderJsonToken(buffer: string, mode: JsonTokenMode, key: number) {
  const className = highlightedTokenClassName(mode)
  return className ? (
    <span key={key} className={className}>
      {buffer}
    </span>
  ) : (
    buffer
  )
}

function renderJsonHighlight(jsonDraft: string, jsonMarker: Set<number>) {
  const tokens: ReactNode[] = []
  let buffer = ''
  let mode: JsonTokenMode = 'plain'
  let escaped = false

  const flushBuffer = () => {
    if (!buffer) return
    tokens.push(renderJsonToken(buffer, mode, tokens.length))
    buffer = ''
    mode = 'plain'
  }

  for (let index = 0; index < jsonDraft.length; index += 1) {
    const char = jsonDraft[index]

    if (jsonMarker.has(index) && ['{', '}', '[', ']', '"', "'"].includes(char)) {
      flushBuffer()
      tokens.push(
        <span key={tokens.length} className="rounded bg-red-500/20 text-red-300">
          {char}
        </span>,
      )
      continue
    }

    if (mode === 'string') {
      buffer += char
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        flushBuffer()
      }
      continue
    }

    if (char === '"') {
      flushBuffer()
      buffer = char
      mode = 'string'
      continue
    }

    if (/[[\]{}:,]/.test(char)) {
      flushBuffer()
      tokens.push(
        <span key={tokens.length} className="text-zinc-400">
          {char}
        </span>,
      )
      continue
    }

    if (char === '\n' || char === ' ' || char === '\t') {
      flushBuffer()
      tokens.push(char === '\t' ? '  ' : char)
      continue
    }

    if (mode === 'plain') {
      buffer = char
      mode = getTokenMode(char)
    } else {
      buffer += char
    }
  }

  flushBuffer()
  return tokens
}

function AboutPopout({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  return (
    <PopoutShell>
      <h3 className="mt-0 text-lg">{t('about')}</h3>
      <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
        <p>{t('aboutIntro')}{' '}{t('aboutReworkSuffix')}{' '}
          <ExternalLink href="https://aerospace-lab.de/repolysat/">RePolySat</ExternalLink>
        </p>
        <div>
          <p className="font-medium text-zinc-800 dark:text-zinc-100">{t('credits')}</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              {t('aboutFoundation')}{' '}
              <ExternalLink href="https://github.com/walgren/Ashby-plots">walgren</ExternalLink>
            </li>
            <li>
              {t('aboutRework')}{' '}
              <ExternalLink href="https://github.com/afffe18">afffe18</ExternalLink>{' '}
            </li>
            <li>
              {t('aboutUiPrefix')}{' '}
              <ExternalLink href="https://github.com/afffe18">afffe18</ExternalLink>
              {' & '}
              <ExternalLink href="https://github.com/13Bytes">13Bytes</ExternalLink>
            </li>
          </ul>
        </div>
      </div>
      <DialogActions>
        <Button variant="outline" onClick={onClose}>
          {t('close')}
        </Button>
      </DialogActions>
    </PopoutShell>
  )
}

/** One line of the settings dialog: the name (and an optional hint) on the left, the control on the right. */
export function SettingsRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="grid min-w-0 gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {hint ? <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SettingsPopout({
  onClose,
  settingsContent,
}: {
  onClose: () => void
  settingsContent: ReactNode
}) {
  const { t } = useI18n()
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return (
    <PopoutShell panelClassName="max-w-lg">
      <div role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="flex items-center justify-between gap-2">
          <h3 id="settings-title" className="m-0 text-lg">{t('settings')}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            title={t('close')}
            className="grid h-8 w-8 place-items-center rounded-md text-lg leading-none text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            ×
          </button>
        </div>
        <div className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">{settingsContent}</div>
      </div>
    </PopoutShell>
  )
}

function GenerateColorsPopout({
  onClose,
  onGenerate,
}: {
  onClose: () => void
  onGenerate: () => void
}) {
  const { t } = useI18n()
  return (
    <PopoutShell>
      <h3 className="mt-0 text-lg">{t('generateColorsTitle')}</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {t('generateColorsText')}
      </p>
      <DialogActions>
        <Button variant="outline" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button onClick={onGenerate}>{t('generateColorsConfirm')}</Button>
      </DialogActions>
    </PopoutShell>
  )
}

function JsonEditorPopout({
  jsonDraft,
  jsonFullscreen,
  jsonMarker,
  jsonOverlayRef,
  jsonTextareaRef,
  onApplyJsonEditor,
  onCloseJson,
  onJsonDraftChange,
  onJsonScroll,
  onToggleJsonFullscreen,
}: Pick<
  AppPopoutsProps,
  | 'jsonDraft'
  | 'jsonFullscreen'
  | 'jsonMarker'
  | 'jsonOverlayRef'
  | 'jsonTextareaRef'
  | 'onApplyJsonEditor'
  | 'onCloseJson'
  | 'onJsonDraftChange'
  | 'onJsonScroll'
  | 'onToggleJsonFullscreen'
>) {
  const { t } = useI18n()
  return (
    <PopoutShell
      panelClassName={cn(
        'overflow-hidden border-zinc-700 p-0 dark:bg-zinc-950',
        jsonFullscreen ? 'h-[96vh] w-[96vw] max-w-none' : 'max-h-[85vh] max-w-4xl',
      )}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">{t('jsonEditor')}</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onToggleJsonFullscreen}>
            {jsonFullscreen ? t('exitFullscreen') : t('fullscreen')}
          </Button>
          <Button variant="outline" size="sm" onClick={onCloseJson}>
            {t('close')}
          </Button>
        </div>
      </div>
      <div className={cn('relative', jsonFullscreen ? 'h-[calc(96vh-7.5rem)]' : 'h-[70vh]')}>
        <pre
          ref={jsonOverlayRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words bg-white p-3 font-mono text-xs leading-[18px] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {renderJsonHighlight(jsonDraft, jsonMarker)}
        </pre>
        <textarea
          ref={jsonTextareaRef}
          className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent p-3 font-mono text-xs leading-[18px] text-transparent caret-zinc-900 dark:caret-zinc-100"
          value={jsonDraft}
          onScroll={(event) => onJsonScroll(event.currentTarget.scrollTop, event.currentTarget.scrollLeft)}
          onChange={(event) => onJsonDraftChange(event.target.value)}
          spellCheck={false}
        />
      </div>
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <Button size="sm" onClick={onApplyJsonEditor}>
          {t('applyJson')}
        </Button>
      </div>
    </PopoutShell>
  )
}

function ResetConfirmPopout({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const { t } = useI18n()
  return (
    <PopoutShell>
      <h3 className="mt-0 text-lg">{t('resetTitle')}</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {t('resetText')}
      </p>
      <DialogActions>
        <Button variant="outline" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button onClick={onConfirm}>{t('resetConfirm')}</Button>
      </DialogActions>
    </PopoutShell>
  )
}

function DatasourcePromptPopout({
  datasourcePrompt,
  onClose,
  onDatasourcePromptFile,
}: {
  datasourcePrompt: NonNullable<AppPopoutsProps['datasourcePrompt']>
  onClose: () => void
  onDatasourcePromptFile: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  const { t } = useI18n()
  return (
    <PopoutShell>
      <h3 className="mt-0 text-lg">{t('datasourceRequiredTitle')}</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {t('datasourceRequiredText', { n: datasourcePrompt.dataframeIndex + 1, filename: datasourcePrompt.filename })}
      </p>
      <div className="mt-4 grid gap-3">
        <input type="file" accept=".xlsx" onChange={onDatasourcePromptFile} />
        <DialogActions className="mt-0">
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </DialogActions>
      </div>
    </PopoutShell>
  )
}

export function AppPopouts(props: AppPopoutsProps) {
  const {
    showAbout,
    showSettings,
    showGenerateColorsConfirm,
    showJson,
    showResetConfirm,
    datasourcePrompt,
    jsonFullscreen,
    jsonDraft,
    jsonMarker,
    settingsContent,
    onCloseAbout,
    onCloseSettings,
    onCloseGenerateColorsConfirm,
    onGenerateMaterialColors,
    onToggleJsonFullscreen,
    onCloseJson,
    onJsonDraftChange,
    onApplyJsonEditor,
    onJsonScroll,
    onCloseResetConfirm,
    onConfirmReset,
    onCloseDatasourcePrompt,
    onDatasourcePromptFile,
    jsonOverlayRef,
    jsonTextareaRef,
  } = props

  return (
    <>
      {showAbout ? <AboutPopout onClose={onCloseAbout} /> : null}
      {showSettings ? <SettingsPopout onClose={onCloseSettings} settingsContent={settingsContent} /> : null}
      {showGenerateColorsConfirm ? (
        <GenerateColorsPopout onClose={onCloseGenerateColorsConfirm} onGenerate={onGenerateMaterialColors} />
      ) : null}
      {showJson ? (
        <JsonEditorPopout
          jsonDraft={jsonDraft}
          jsonFullscreen={jsonFullscreen}
          jsonMarker={jsonMarker}
          jsonOverlayRef={jsonOverlayRef}
          jsonTextareaRef={jsonTextareaRef}
          onApplyJsonEditor={onApplyJsonEditor}
          onCloseJson={onCloseJson}
          onJsonDraftChange={onJsonDraftChange}
          onJsonScroll={onJsonScroll}
          onToggleJsonFullscreen={onToggleJsonFullscreen}
        />
      ) : null}
      {showResetConfirm ? <ResetConfirmPopout onClose={onCloseResetConfirm} onConfirm={onConfirmReset} /> : null}
      {datasourcePrompt ? (
        <DatasourcePromptPopout
          datasourcePrompt={datasourcePrompt}
          onClose={onCloseDatasourcePrompt}
          onDatasourcePromptFile={onDatasourcePromptFile}
        />
      ) : null}
    </>
  )
}
