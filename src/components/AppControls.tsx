import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/utils'
import { getFieldHelp, useI18n } from '../uiTranslations'
import type { MultiOption } from '../utils/appState'
import { HEX_COLOR, resolvePreviewColor } from '../utils/colors'
import { Input } from './ui/input'
import { Select } from './ui/select'
import { ColorDot } from './ColorPicker'

const TOOLTIP_WIDTH_PX = 288

type TooltipPosition = { left: number; top: number; alignRight: boolean }

/**
 * Styled tooltip bubble shown while its `group` parent is hovered or focused. Positioned fixed at
 * the anchor, so scrolling panels neither clip it nor grow a scrollbar for it.
 */
function TooltipBubble({ id, position, children }: { id: string; position: TooltipPosition | null; children: ReactNode }) {
  const width = `min(${TOOLTIP_WIDTH_PX}px, calc(100vw - 2rem))`
  return (
    <span
      role="tooltip"
      id={id}
      style={position ? { width, top: position.top, ...(position.alignRight ? { right: `calc(100vw - ${position.left}px)` } : { left: position.left }) } : { width }}
      className="pointer-events-none fixed z-50 hidden rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-zinc-700 shadow-lg group-focus-within:block group-hover:block dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
    >
      <span aria-hidden="true" className={`absolute -top-1 h-2 w-2 rotate-45 border-l border-t border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 ${position?.alignRight ? 'right-3' : 'left-3'}`} />
      {children}
    </span>
  )
}

/** Places a tooltip below its anchor; it opens to the left when there is not enough room on the right. */
function useTooltipAlignment() {
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const [position, setPosition] = useState<TooltipPosition | null>(null)
  const updateAlignment = () => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect) return
    const alignRight = rect.left + TOOLTIP_WIDTH_PX + 16 > window.innerWidth
    setPosition({ alignRight, top: rect.bottom + 8, left: alignRight ? rect.right + 8 : rect.left - 8 })
  }
  return { anchorRef, position, updateAlignment }
}

/**
 * "?" badge with a styled tooltip. Opens on hover and keyboard focus, shows the help text and the
 * config path, and opens to the left when there is not enough room on the right.
 */
export function InfoTooltip({ label, text, jsonPath }: { label: string; text: string; jsonPath?: string }) {
  const { t } = useI18n()
  const tooltipId = useId()
  const { anchorRef, position, updateAlignment } = useTooltipAlignment()

  return (
    <span ref={anchorRef} className="group relative inline-flex align-middle" onPointerEnter={updateAlignment} onFocus={updateAlignment}>
      <button
        type="button"
        aria-label={t('fieldHelp', { label })}
        aria-describedby={tooltipId}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-zinc-400 text-[10px] font-semibold leading-none text-zinc-500 transition-colors hover:border-brand-500 hover:text-brand-600 focus-visible:border-brand-500 focus-visible:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-brand-400 dark:hover:text-brand-300"
      >
        ?
      </button>
      <TooltipBubble id={tooltipId} position={position}>
        <span className="block">{text}</span>
        {jsonPath ? <code className="mt-1.5 block border-t border-zinc-100 pt-1.5 font-mono text-[10px] text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">{jsonPath}</code> : null}
      </TooltipBubble>
    </span>
  )
}

/** Shows `note` in a tooltip bubble while `children` are hovered or focused. */
export function HoverNote({ note, children, className }: { note: ReactNode; children: ReactNode; className?: string }) {
  const tooltipId = useId()
  const { anchorRef, position, updateAlignment } = useTooltipAlignment()
  return (
    <span ref={anchorRef} aria-describedby={tooltipId} className={cn('group relative flex', className)} onPointerEnter={updateAlignment} onFocus={updateAlignment}>
      {children}
      <TooltipBubble id={tooltipId} position={position}>{note}</TooltipBubble>
    </span>
  )
}

/** How much attention a setting needs: must be set, worth a look, or fine at its default. */
export type SettingLevel = 'required' | 'check' | 'default'

const EyeIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5" aria-hidden="true">
    <path d="M1.5 10S5 4 10 4s8.5 6 8.5 6-3.5 6-8.5 6-8.5-6-8.5-6z" />
    <circle cx="10" cy="10" r="2.5" />
  </svg>
)

/** Small icon for a setting level with a tooltip that explains it. */
export function LevelIcon({ level, missing, changed }: { level: SettingLevel; missing?: boolean; changed?: boolean }) {
  const { t } = useI18n()
  const tooltipId = useId()
  const { anchorRef, position, updateAlignment } = useTooltipAlignment()
  const tip = level === 'required'
    ? missing ? t('levelRequiredMissingTip') : missing === false ? t('levelRequiredSetTip') : t('levelRequiredTip')
    : level === 'check'
      ? t('levelCheckTip')
      : changed ? t('levelChangedTip') : t('levelDefaultTip')
  const label = level === 'required' ? t('levelRequired') : level === 'check' ? t('levelCheck') : t('levelDefault')
  const iconClassName = level === 'required'
    ? missing
      ? 'h-4 w-4 bg-orange-600 text-white'
      : missing === false
        ? 'h-4 w-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
        : 'h-4 w-4 bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
    : level === 'check'
      ? 'h-4 w-4 text-zinc-500 ring-1 ring-inset ring-zinc-400 dark:text-zinc-400 dark:ring-zinc-600'
      : changed
        ? 'm-0.5 h-3 w-3 bg-brand-500'
        : 'm-0.5 h-3 w-3 ring-1 ring-inset ring-zinc-400 dark:ring-zinc-600'

  return (
    <span ref={anchorRef} className="group relative inline-flex align-middle" onPointerEnter={updateAlignment} onFocus={updateAlignment}>
      <span
        tabIndex={0}
        role="img"
        aria-label={tip}
        aria-describedby={tooltipId}
        className={`inline-flex shrink-0 cursor-help items-center justify-center rounded-full text-[10px] font-bold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 ${iconClassName}`}
      >
        {level === 'required' ? (missing ? '!' : missing === false ? '✓' : '*') : level === 'check' ? <EyeIcon /> : null}
      </span>
      <TooltipBubble id={tooltipId} position={position}>
        <strong className="block font-semibold">{label}</strong>
        <span className="block">{tip}</span>
      </TooltipBubble>
    </span>
  )
}

/** Amber icon for a value that may be wrong now, e.g. coordinates entered for other axes; the text explains why. */
function WarningIcon({ text }: { text: string }) {
  const tooltipId = useId()
  const { anchorRef, position, updateAlignment } = useTooltipAlignment()
  return (
    <span ref={anchorRef} className="group relative inline-flex align-middle" onPointerEnter={updateAlignment} onFocus={updateAlignment}>
      <span tabIndex={0} role="img" aria-label={text} aria-describedby={tooltipId} className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 dark:text-amber-400">
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <path d="M10 2.5 18.5 17.5h-17z" fill="currentColor" />
          <path d="M10 8v4.5M10 14.8v.2" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <TooltipBubble id={tooltipId} position={position}>{text}</TooltipBubble>
    </span>
  )
}

/** Label with the level icon and an optional help tooltip; the help text is looked up by the config path. */
function FieldLabel({ label, jsonPath, as: Tag = 'label', level, missing, changed, lang, warning }: { label: string; jsonPath: string; as?: 'label' | 'span'; level?: SettingLevel; missing?: boolean; changed?: boolean; lang?: string; warning?: string }) {
  const { language } = useI18n()
  const help = getFieldHelp(language, jsonPath)
  return (
    <span className="flex min-h-5 flex-wrap items-center gap-1.5">
      <Tag title={help ? undefined : jsonPath} className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</Tag>
      {lang ? <span className="rounded px-1 font-mono text-[10px] uppercase leading-4 text-zinc-500 ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700">{lang}</span> : null}
      {level ? <LevelIcon level={level} missing={missing} changed={changed} /> : null}
      {warning ? <WarningIcon text={warning} /> : null}
      {help ? <InfoTooltip label={label} text={help} jsonPath={jsonPath} /> : null}
    </span>
  )
}

export function Field({
  label,
  jsonPath,
  level,
  missing,
  changed,
  lang,
  otherLang,
  anchor,
  hint,
  fill,
  selfClassName,
  className,
  warning,
  children,
}: {
  label: string
  jsonPath: string
  /** Required, worth checking, or fine at its default (hidden in Simple mode). */
  level?: SettingLevel
  /** For required settings: true while not set, false once set. */
  missing?: boolean
  /** For default settings: the value differs from the default. */
  changed?: boolean
  /** Language of a per-language text field; shown as a tag. */
  lang?: string
  /** Text field of a plot language other than the selected one (hidden in Simple mode). */
  otherLang?: boolean
  /** Stable name to jump to this field, e.g. from a "missing" message. */
  anchor?: string
  hint?: ReactNode
  /** Stretch to the height of the grid row, e.g. a list next to other fields. */
  fill?: boolean
  selfClassName?: string
  className?: string
  /** Shown as an amber icon next to the label, e.g. when the value may not fit the plot any more. */
  warning?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn('grid gap-1.5 rounded-md', fill ? (hint ? 'h-full grid-rows-[auto_minmax(0,1fr)_auto]' : 'h-full grid-rows-[auto_minmax(0,1fr)]') : 'content-start', selfClassName)}
      data-setting={label}
      data-anchor={anchor}
      data-level={level}
      data-changed={level === 'default' && changed ? 'true' : undefined}
      data-missing={missing ? 'true' : undefined}
      data-lang-other={otherLang ? 'true' : undefined}
    >
      <FieldLabel label={label} jsonPath={jsonPath} level={level} missing={missing} changed={changed} lang={lang} warning={warning} />
      <div className={cn('grid gap-2', fill && 'min-h-0', className)}>
        {children}
      </div>
      {hint ? <p className="m-0 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  )
}

/** Grid columns of a FieldGroup: its rows side by side, each row a tag column and a value column. */
const GROUP_COLUMNS = {
  1: 'grid-cols-[auto_minmax(0,1fr)]',
  2: 'grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] [&>:nth-child(even)>:first-child]:ml-2',
  /** Two columns once there is room, e.g. for rows with a toggle next to the input. */
  responsive: 'grid-cols-[auto_minmax(0,1fr)] @xl:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] @xl:[&>:nth-child(even)>:first-child]:ml-2',
} as const

/**
 * Several values that belong together (one text per language, one coordinate per axis) in one
 * framed box under a common label, one GroupedField row per value. Counts as one setting: search,
 * Simple mode and the section statistics treat it like a Field.
 */
export function FieldGroup({
  label,
  jsonPath,
  level,
  missing,
  changed,
  anchor,
  columns = 1,
  inline,
  warning,
  children,
}: {
  label: string
  jsonPath: string
  level?: SettingLevel
  missing?: boolean
  changed?: boolean
  anchor?: string
  columns?: keyof typeof GROUP_COLUMNS
  /** Without the frame, laid out like a Field, so its inputs line up with plain fields next to it. */
  inline?: boolean
  /** Shown as an amber icon next to the label, e.g. when the values may not fit the plot any more. */
  warning?: string
  children: ReactNode
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={inline ? 'grid content-start gap-1.5' : 'grid content-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 pb-3 pt-2 dark:border-zinc-800 dark:bg-zinc-900/40'}
      data-setting={label}
      data-anchor={anchor}
      data-level={level}
      data-changed={level === 'default' && changed ? 'true' : undefined}
      data-missing={missing ? 'true' : undefined}
    >
      <FieldLabel label={label} jsonPath={jsonPath} as="span" level={level} missing={missing} changed={changed} warning={warning} />
      <div className={cn('grid items-center gap-x-2 gap-y-2', GROUP_COLUMNS[columns])}>{children}</div>
    </div>
  )
}

/** One row of a FieldGroup: a tag (language, axis, side) left of its input. The tags of a column line up. */
export function GroupedField({ tag, title, missing, otherLang, simpleHidden, children }: {
  tag: ReactNode
  /** Full text of a shortened or truncated tag. */
  title?: string
  missing?: boolean
  /** Text of a plot language other than the selected one (hidden in Simple mode). */
  otherLang?: boolean
  /** Not needed by this plot, e.g. an axis it does not show (hidden in Simple mode). */
  simpleHidden?: boolean
  children: ReactNode
}) {
  return (
    <label className="col-span-2 grid grid-cols-subgrid items-center" data-missing={missing ? 'true' : undefined} data-lang-other={otherLang ? 'true' : undefined} data-level={simpleHidden ? 'default' : undefined}>
      <span title={title} className="min-w-8 max-w-40 truncate rounded px-1.5 py-0.5 text-center font-mono text-[10px] text-zinc-500 ring-1 ring-inset ring-zinc-300 dark:text-zinc-400 dark:ring-zinc-700">{tag}</span>
      <div className="flex min-w-0 items-center gap-2 [&>input]:min-w-0">{children}</div>
    </label>
  )
}

/**
 * One text field per plot language, grouped under the label when there are several. Simple mode
 * shows the selected language only.
 */
export function LanguageFields({
  label,
  jsonPath,
  level,
  languages,
  selectedLanguage,
  value,
  onChange,
  anchor,
}: {
  label: string
  jsonPath: string
  level?: SettingLevel
  languages: string[]
  selectedLanguage: string
  value: (language: string) => string
  onChange: (language: string, next: string) => void
  anchor?: string
}) {
  if (languages.length > 1) {
    return (
      <FieldGroup label={label} jsonPath={jsonPath} level={level} anchor={anchor}>
        {languages.map((language) => (
          <GroupedField key={language} tag={language.toUpperCase()} otherLang={language !== selectedLanguage}>
            <Input aria-label={`${label} (${language})`} value={value(language)} onChange={(event) => onChange(language, event.target.value)} />
          </GroupedField>
        ))}
      </FieldGroup>
    )
  }
  return (
    <>
      {languages.map((language) => (
        <Field key={language} label={label} jsonPath={jsonPath} level={level} anchor={anchor}>
          <Input value={value(language)} onChange={(event) => onChange(language, event.target.value)} />
        </Field>
      ))}
    </>
  )
}

/** Titled group inside a section; `level="default"` hides the whole group in Simple mode. */
export function SettingsGroup({ title, level, actions, children, className, anchor }: { title?: ReactNode; level?: SettingLevel; actions?: ReactNode; children: ReactNode; className?: string; anchor?: string }) {
  return (
    <div className={cn('grid gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800', className)} data-level={level} data-anchor={anchor}>
      {title || actions ? (
        <div className="flex flex-wrap items-center gap-2">
          {title ? <h4 className="m-0 font-mono text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{title}</h4> : null}
          {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

/** Small uppercase tag naming who a setting affects. */
export function ScopeTag({ scope, children }: { scope: 'dataset' | 'plot' | 'project'; children: ReactNode }) {
  const className = scope === 'dataset'
    ? 'bg-violet-50 text-violet-800 ring-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-800'
    : scope === 'plot'
      ? 'bg-brand-50 text-brand-700 ring-brand-400 dark:bg-brand-950/60 dark:text-brand-300 dark:ring-brand-700'
      : 'bg-zinc-100 text-zinc-600 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700'
  return <span className={`inline-flex w-fit items-center rounded px-1.5 font-mono text-[10px] font-medium uppercase leading-5 tracking-wider ring-1 ring-inset ${className}`}>{children}</span>
}

export const LinkIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={cn('h-3.5 w-3.5 shrink-0', className)} aria-hidden="true">
    <path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" />
    <path d="M11.5 8.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
  </svg>
)

/** Note that a plot setting depends on a shared dataset setting, with a link to it. */
export function SharedHint({ text, linkLabel, onOpen }: { text: string; linkLabel: string; onOpen: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">
      <LinkIcon />
      <span>{text}</span>
      <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={onOpen}>{linkLabel} →</button>
    </div>
  )
}

/** Toggle: segmented control for a small set of choices, e.g. Simple / All settings. */
export function Toggle<T extends string>({ options, value, onChange, className, ariaLabel, size }: { options: Array<{ value: T; label: ReactNode; title?: string }>; value: T; onChange: (next: T) => void; className?: string; ariaLabel?: string; size?: 'sm' }) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn('inline-flex w-fit shrink-0 items-stretch gap-0.5 rounded-md border border-zinc-300 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-900', size === 'sm' ? 'h-8' : 'h-9', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`flex items-center whitespace-nowrap rounded text-xs transition-colors ${size === 'sm' ? 'px-2' : 'px-3'} ${option.value === value ? 'bg-white font-semibold text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Common values as one-click presets, plus a field for any other value: it shows a grey "custom"
 * while a preset is selected and the value otherwise. Text that does not parse is marked and not applied.
 */
export function PresetInput<T>({ presets, value, isSame, format, parse, onChange, ariaLabel, disabled }: {
  presets: Array<{ value: T; label: string }>
  value: T
  isSame: (a: T, b: T) => boolean
  format: (value: T) => string
  /** undefined for text that is not a valid value */
  parse: (text: string) => T | undefined
  onChange: (next: T) => void
  ariaLabel: string
  disabled?: boolean
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<string | null>(null)
  const isPreset = presets.some((preset) => isSame(preset.value, value))
  const invalid = draft !== null && draft.trim() !== '' && parse(draft) === undefined
  const selectedClassName = 'bg-white font-semibold text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
  return (
    <div role="group" aria-label={ariaLabel} className={cn('inline-flex h-9 w-fit max-w-full items-stretch gap-0.5 rounded-md border border-zinc-300 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-900', disabled && 'pointer-events-none opacity-50')}>
      {presets.map((preset) => {
        const selected = isSame(preset.value, value) && draft === null
        return (
          <button
            key={preset.label}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => { setDraft(null); onChange(preset.value) }}
            className={`flex items-center whitespace-nowrap rounded px-2.5 text-xs tabular-nums transition-colors ${selected ? selectedClassName : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`}
          >
            {preset.label}
          </button>
        )
      })}
      <input
        type="text"
        inputMode="decimal"
        aria-label={`${ariaLabel}: ${t('customPreset')}`}
        aria-invalid={invalid}
        disabled={disabled}
        placeholder={t('customPreset')}
        value={draft ?? (isPreset ? '' : format(value))}
        onChange={(event) => {
          setDraft(event.target.value)
          const parsed = parse(event.target.value)
          if (parsed !== undefined) onChange(parsed)
        }}
        onBlur={() => setDraft(null)}
        className={`w-20 min-w-0 rounded px-2 text-xs tabular-nums outline-none placeholder:text-zinc-400 focus-visible:ring-1 focus-visible:ring-brand-400 dark:placeholder:text-zinc-500 ${invalid ? 'bg-white text-red-600 ring-1 ring-red-500 dark:bg-zinc-800' : !isPreset || draft !== null ? selectedClassName : 'bg-transparent text-zinc-900 dark:text-zinc-100'}`}
      />
    </div>
  )
}

/** Switch: on/off control with its state as text, e.g. transparency. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label?: string }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="inline-flex h-9 w-fit items-center gap-2 rounded-md border border-zinc-300 bg-white px-2.5 text-xs shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
    >
      <span className={`relative h-4 w-7 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${checked ? 'left-3.5' : 'left-0.5'}`} />
      </span>
      <span className={checked ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}>{checked ? t('on') : t('off')}</span>
    </button>
  )
}

/**
 * Opacity from 0 (not drawn) to 1 (opaque): a slider with the exact value next to it. Invalid text
 * in the number field is not applied.
 */
export function OpacitySlider({ value, onChange, ariaLabel }: { value: number; onChange: (next: number) => void; ariaLabel: string }) {
  const clamp = (next: number) => Math.min(1, Math.max(0, Math.round(next * 100) / 100))
  return (
    <div className="flex h-9 items-center gap-3">
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(clamp(event.target.valueAsNumber))}
        className="h-5 min-w-0 flex-1 cursor-pointer accent-brand-600 dark:accent-brand-400"
      />
      <Input
        type="number"
        min={0}
        max={1}
        step={0.05}
        aria-label={`${ariaLabel} (0–1)`}
        value={value}
        onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) onChange(clamp(event.target.valueAsNumber)) }}
        className="w-20 shrink-0 tabular-nums"
      />
    </div>
  )
}

/** Small read-only preview of a color; a dashed outline when the color cannot be shown. */
export function ColorSwatch({ color, title, round }: { color: string | undefined; title?: string; round?: boolean }) {
  return (
    <span
      title={title ?? color}
      aria-hidden="true"
      className={`inline-block shrink-0 border ${round ? 'h-7 w-7 rounded-full' : 'h-4 w-4 rounded'} ${color ? 'border-black/20 dark:border-white/30' : 'border-dashed border-zinc-400'}`}
      style={color ? { backgroundColor: color } : undefined}
    />
  )
}

export function MultiSelectInput({
  value,
  options,
  title,
  jsonPath,
  colorFor,
  onChange,
  expanded,
  onToggleExpanded,
  hideModeToggle = false,
  modeValue,
  onModeChange,
}: {
  value: string[]
  options: MultiOption[]
  /** Optional title row above the search row (empty when a Field shows the label). */
  title: string
  /** Config path for the help tooltip next to the title. */
  jsonPath?: string
  /** Preview color per option value, e.g. the material color of a keyword. */
  colorFor?: (value: string) => string | undefined
  onChange: (next: string[]) => void
  expanded?: boolean
  onToggleExpanded?: () => void
  hideModeToggle?: boolean
  modeValue?: boolean
  onModeChange?: (next: boolean) => void
}) {
  const { t } = useI18n()
  const selected = new Set(value)
  const allSelected = options.length > 0 && value.length === options.length
  const [searchTerm, setSearchTerm] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)
  const expandedRef = useRef(expanded)
  // Read by the ResizeObserver callback below; refs must not be written during render.
  useEffect(() => {
    expandedRef.current = expanded
  }, [expanded])
  const [overflowsWhenCollapsed, setOverflowsWhenCollapsed] = useState(false)
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const visibleOptions = normalizedSearch.length === 0
    ? options
    : options.filter((option) => option.label.toLowerCase().includes(normalizedSearch) || option.value.toLowerCase().includes(normalizedSearch))

  // Tracks whether the collapsed list overflows, to show the expand arrow only when it helps.
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const measure = () => {
      if (!expandedRef.current) {
        setOverflowsWhenCollapsed(el.scrollHeight > el.clientHeight + 1)
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [visibleOptions.length, expanded])

  // Collapsed, the content is positioned absolutely: the list takes the height of its grid row
  // (set by the fields next to it) and scrolls inside. Expanded, it shows every entry.
  return (
    <div className={`relative ${expanded ? '' : 'h-full min-h-40'}`}>
    <div className={`flex flex-col gap-2 ${expanded ? '' : 'absolute inset-0'}`}>
      {title ? (
        <div className="shrink-0">
          {jsonPath ? <FieldLabel label={title} jsonPath={jsonPath} as="span" /> : <span className="font-medium text-zinc-900 dark:text-zinc-100">{title}</span>}
        </div>
      ) : null}
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <line x1="16.5" y1="16.5" x2="12.6" y2="12.6" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Escape') setSearchTerm('') }}
            placeholder={t('searchOptions')}
            aria-label={t('search')}
            className="h-9 w-full rounded-md border border-zinc-300 bg-white pl-8 pr-7 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          {searchTerm ? (
            <button
              type="button"
              aria-label={t('clearSearch')}
              title={t('clearSearch')}
              onClick={() => setSearchTerm('')}
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              ✕
            </button>
          ) : null}
        </div>
        {!hideModeToggle && onModeChange ? (
          <Toggle<'blacklist' | 'whitelist'>
            ariaLabel={`${t('blacklist')} / ${t('whitelist')}`}
            value={modeValue ? 'whitelist' : 'blacklist'}
            onChange={(next) => onModeChange(next === 'whitelist')}
            options={[{ value: 'blacklist', label: t('blacklist') }, { value: 'whitelist', label: t('whitelist') }]}
          />
        ) : null}
        <button
          type="button"
          aria-label={allSelected ? t('deselectAll') : t('selectAll')}
          title={allSelected ? t('deselectAll') : t('selectAll')}
          onClick={() => onChange(allSelected ? [] : options.map((entry) => entry.value))}
          disabled={options.length === 0}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-500 hover:text-brand-600 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-brand-300"
        >
          {allSelected ? (
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <rect x="3" y="3" width="14" height="14" rx="2" />
              <line x1="6.5" y1="10" x2="13.5" y2="10" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <rect x="3" y="3" width="14" height="14" rx="2" />
              <path d="M6.5 10.2l2.3 2.3 4.7-4.7" />
            </svg>
          )}
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
      <div
        ref={listRef}
        className={`overflow-auto rounded-md border border-zinc-300 bg-white px-2 py-1 [scrollbar-width:thin] dark:border-zinc-700 dark:bg-zinc-900 ${expanded ? 'pb-8' : 'h-full'}`}
      >
        {visibleOptions.length > 0 ? (
          visibleOptions.map((option) => {
            const color = colorFor?.(option.value)
            return (
              <label key={option.value} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  className="accent-brand-600"
                  checked={selected.has(option.value)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...new Set([...value, option.value])]
                        : value.filter((entry) => entry !== option.value),
                    )
                  }
                />
                {color ? <ColorSwatch color={color} /> : null}
                <span>{option.label}</span>
              </label>
            )
          })
        ) : (
          <p className="m-0 py-1 text-sm text-zinc-500">{options.length === 0 ? t('noOptions') : t('noSearchResults')}</p>
        )}
      </div>
      {onToggleExpanded && (expanded || overflowsWhenCollapsed) ? (
        // Chevron in the bottom right corner of the list, left of its (thin) scrollbar.
        <button
          type="button"
          aria-label={expanded ? t('collapse') : t('expand')}
          aria-expanded={expanded}
          title={expanded ? t('collapse') : t('expand')}
          onClick={onToggleExpanded}
          className="absolute bottom-1.5 right-3.5 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-500 shadow-sm hover:border-brand-400 hover:text-brand-600 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-400 dark:hover:text-brand-300"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
            <path d="M5.5 7.5l4.5 4.5 4.5-4.5" />
          </svg>
        </button>
      ) : null}
      </div>
    </div>
    </div>
  )
}

/**
 * Text input for values that are parsed from text (JSON, number lists). Keeps the raw text while
 * the field is focused so intermediate, not-yet-valid input is not thrown away, and only commits
 * values that parse. `parse` returns undefined for invalid text.
 */
export function DraftInput<T>({
  value,
  parse,
  onCommit,
  multiline = false,
  className,
}: {
  value: string
  parse: (text: string) => T | undefined
  onCommit: (next: T) => void
  multiline?: boolean
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? value
  const invalid = draft !== null && parse(draft) === undefined
  const handleChange = (next: string) => {
    setDraft(next)
    const parsed = parse(next)
    if (parsed !== undefined) onCommit(parsed)
  }
  const invalidClassName = invalid ? 'border-red-500 focus-visible:ring-red-500' : ''

  return multiline ? (
    <textarea
      className={`min-h-24 rounded-md border border-zinc-300 bg-white p-2 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${invalidClassName} ${className ?? ''}`}
      value={text}
      aria-invalid={invalid}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={() => setDraft(null)}
      spellCheck={false}
    />
  ) : (
    <Input
      className={`${invalidClassName} ${className ?? ''}`}
      value={text}
      aria-invalid={invalid}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={() => setDraft(null)}
    />
  )
}


/**
 * Collapsible row for a list item (axis, layer, area, guideline, annotation): a one-line summary
 * that opens the details when clicked, plus duplicate and remove. The section controls which
 * cards are open (new items open by default). The details stay in the DOM while closed, so "Find
 * a setting" can reach them; a `settings-reveal` event asks to open the card.
 */
export function ItemCard({
  icon,
  title,
  summary,
  badge,
  open,
  onOpenChange,
  onDuplicate,
  onRemove,
  removeDisabled,
  children,
}: {
  icon?: ReactNode
  title: ReactNode
  summary?: ReactNode
  badge?: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  onDuplicate?: () => void
  onRemove: () => void
  removeDisabled?: boolean
  children: ReactNode
}) {
  const { t } = useI18n()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  })
  useEffect(() => {
    const element = rootRef.current
    if (!element) return
    const reveal = () => onOpenChangeRef.current(true)
    element.addEventListener('settings-reveal', reveal)
    return () => element.removeEventListener('settings-reveal', reveal)
  }, [])

  return (
    <div
      ref={rootRef}
      className={`rounded-lg border bg-white transition-colors dark:bg-zinc-950 has-[[data-remove]:hover]:border-red-500 has-[[data-duplicate]:hover]:border-blue-500 ${open ? 'border-brand-400 shadow-[0_0_0_3px_rgb(139_92_246/0.12)] dark:border-brand-700' : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'}`}
    >
      <div className="flex min-w-0 items-center gap-1 pr-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-2 pl-3 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
        >
          {icon ? <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-zinc-100 text-xs dark:bg-zinc-800">{icon}</span> : null}
          <span className="flex min-w-0 flex-1 items-baseline gap-2.5 overflow-hidden">
            <span className="shrink-0 text-sm font-semibold">{title}</span>
            {summary ? <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{summary}</span> : null}
          </span>
          {badge}
          <span title={open ? t('done') : t('edit')} className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${open ? 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300' : 'text-zinc-400'}`}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M12.8 3.7l3.5 3.5-9.1 9.1-4.1.6.6-4.1z" />
              <path d="M11.3 5.2l3.5 3.5" />
            </svg>
          </span>
        </button>
        {onDuplicate ? (
          <button type="button" data-duplicate className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 hover:bg-blue-500 hover:text-white" onClick={onDuplicate} aria-label={t('duplicate')} title={t('duplicate')}>⧉</button>
        ) : null}
        <button type="button" data-remove disabled={removeDisabled} className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 hover:bg-red-500 hover:text-white disabled:pointer-events-none disabled:opacity-40" onClick={onRemove} aria-label={t('remove')} title={t('remove')}>✕</button>
      </div>
      <div hidden={!open} className="grid gap-4 border-t border-zinc-200 px-4 pb-4 pt-3 dark:border-zinc-800">
        {children}
      </div>
    </div>
  )
}

/** Placeholder for an empty list of items. */
export function EmptyItems({ children }: { children: ReactNode }) {
  return <p className="m-0 rounded-lg border border-dashed border-zinc-300 p-3 text-center text-xs text-zinc-500 dark:border-zinc-700">{children}</p>
}

/**
 * Color input that either references a material color (select + round swatch of the resolved
 * color) or holds a custom #hex color (round picker + text). A plain color name such as "aqua" is
 * shown in the material select as its own entry, so existing configs display correctly.
 */
export function ColorOrMaterialInput({
  value,
  onChange,
  materialColors,
}: {
  value: string
  onChange: (next: string) => void
  materialColors: Record<string, string>
}) {
  const { t } = useI18n()
  const trimmed = value.trim()
  const isCustom = HEX_COLOR.test(trimmed)
  const materialNames = Object.keys(materialColors)
  const options = trimmed && !materialNames.includes(trimmed) ? [trimmed, ...materialNames] : materialNames
  const switchMode = (next: 'custom' | 'material') => {
    if (next === 'material' && isCustom) {
      onChange(materialNames[0] ?? 'default')
      return
    }
    if (next === 'custom' && !isCustom) {
      // Start the custom color from the currently shown color when it is a hex value.
      const current = resolvePreviewColor(trimmed, materialColors)
      onChange(current && /^#[0-9a-f]{6}$/i.test(current) ? current : '#000000')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle
        options={[{ value: 'custom', label: t('colorModeCustom') }, { value: 'material', label: t('colorModeMaterial') }]}
        value={isCustom ? 'custom' : 'material'}
        onChange={switchMode}
      />
      {isCustom ? (
        <span className="flex min-w-32 flex-1 items-center gap-2">
          <ColorDot value={trimmed} onChange={onChange} label={t('color')} presets={Object.values(materialColors)} />
          <Input className="font-mono text-xs" value={value} onChange={(e) => onChange(e.target.value)} />
        </span>
      ) : (
        <span className="flex min-w-32 flex-1 items-center gap-2">
          <ColorSwatch color={resolvePreviewColor(trimmed, materialColors)} title={materialColors[trimmed] ?? trimmed} round />
          <Select value={trimmed} onChange={(e) => onChange(e.target.value)}>
            {options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        </span>
      )}
    </div>
  )
}

