import { useId, useRef, useState, type ReactNode } from 'react'
import { getFieldHelp, useI18n } from '../uiTranslations'
import type { MultiOption } from '../utils/appState'
import { HEX_COLOR, resolvePreviewColor } from '../utils/colors'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'

const TOOLTIP_WIDTH_PX = 288

/**
 * "?" badge with a styled tooltip. Opens on hover and keyboard focus, shows the help text and the
 * config path, and opens to the left when there is not enough room on the right.
 */
export function InfoTooltip({ label, text, jsonPath }: { label: string; text: string; jsonPath?: string }) {
  const { t } = useI18n()
  const tooltipId = useId()
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const [alignRight, setAlignRight] = useState(false)
  const updateAlignment = () => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (rect) setAlignRight(rect.left + TOOLTIP_WIDTH_PX + 16 > window.innerWidth)
  }

  return (
    <span ref={anchorRef} className="group relative inline-flex align-middle" onPointerEnter={updateAlignment} onFocus={updateAlignment}>
      <button
        type="button"
        aria-label={t('fieldHelp', { label })}
        aria-describedby={tooltipId}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-zinc-400 text-[10px] font-semibold leading-none text-zinc-500 transition-colors hover:border-violet-500 hover:text-violet-600 focus-visible:border-violet-500 focus-visible:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-violet-400 dark:hover:text-violet-300"
      >
        ?
      </button>
      <span
        role="tooltip"
        id={tooltipId}
        style={{ width: `min(${TOOLTIP_WIDTH_PX}px, calc(100vw - 2rem))` }}
        className={`pointer-events-none invisible absolute top-full z-50 mt-2 translate-y-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-zinc-700 opacity-0 shadow-lg transition duration-150 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 ${alignRight ? '-right-2' : '-left-2'}`}
      >
        <span aria-hidden="true" className={`absolute -top-1 h-2 w-2 rotate-45 border-l border-t border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 ${alignRight ? 'right-3' : 'left-3'}`} />
        <span className="block">{text}</span>
        {jsonPath ? <code className="mt-1.5 block border-t border-zinc-100 pt-1.5 font-mono text-[10px] text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">{jsonPath}</code> : null}
      </span>
    </span>
  )
}

/** Label with an optional help tooltip; the help text is looked up by the config path. */
function FieldLabel({ label, jsonPath, as: Tag = 'label' }: { label: string; jsonPath: string; as?: 'label' | 'span' }) {
  const { language } = useI18n()
  const help = getFieldHelp(language, jsonPath)
  return (
    <span className="flex items-center gap-1.5">
      <Tag title={help ? undefined : jsonPath} className="font-medium text-zinc-900 dark:text-zinc-100">{label}</Tag>
      {help ? <InfoTooltip label={label} text={help} jsonPath={jsonPath} /> : null}
    </span>
  )
}

export function Field({
  label,
  jsonPath,
  selfClassName,
  className,
  children,
}: {
  label: string
  jsonPath: string
  selfClassName?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`grid gap-2 ${selfClassName || ''}`}>
      <FieldLabel label={label} jsonPath={jsonPath} />
      <div className={`grid gap-2 ${className || ''}`}>
        {children}
      </div>
    </div>
  )
}

/** Section heading with the help text for the whole section. */
export function SectionHeading({ title, jsonPath, className }: { title: string; jsonPath?: string; className?: string }) {
  const { language } = useI18n()
  const help = jsonPath ? getFieldHelp(language, jsonPath) : undefined
  return (
    <h3 className={`m-0 flex items-center gap-2 text-m font-semibold text-violet-500 ${className ?? ''}`}>
      {title}
      {help ? <InfoTooltip label={title} text={help} /> : null}
    </h3>
  )
}

/** Small read-only preview of a color; a dashed box when the color cannot be shown. */
export function ColorSwatch({ color, title }: { color: string | undefined; title?: string }) {
  return (
    <span
      title={title ?? color}
      aria-hidden="true"
      className={`inline-block h-4 w-4 shrink-0 rounded border ${color ? 'border-black/20 dark:border-white/30' : 'border-dashed border-zinc-400'}`}
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
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const visibleOptions = normalizedSearch.length === 0
    ? options
    : options.filter((option) => option.label.toLowerCase().includes(normalizedSearch) || option.value.toLowerCase().includes(normalizedSearch))

  return (
    <div className="grid gap-2 h-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {jsonPath ? <FieldLabel label={title} jsonPath={jsonPath} as="span" /> : <span className="font-medium text-zinc-900 dark:text-zinc-100">{title}</span>}
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setShowSearch((current) => !current)}>
            {showSearch ? t('hideSearch') : t('search')}
          </Button>
          {!hideModeToggle && onModeChange ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onModeChange(!(modeValue ?? false))}>
              {modeValue ? t('whitelist') : t('blacklist')}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(allSelected ? [] : options.map((entry) => entry.value))} disabled={options.length === 0}>
            {allSelected ? t('deselectAll') : t('selectAll')}
          </Button>
          {onToggleExpanded ? (
            <Button type="button" size="sm" variant="outline" onClick={onToggleExpanded}>
              {expanded ? t('collapse') : t('expand')}
            </Button>
          ) : null}
        </div>
      </div>
      {showSearch ? (
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={t('searchOptions')}
        />
      ) : null}
      <div className={`${expanded ? 'h-full min-h-28' : 'h-47'} overflow-auto rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900`}>
        {visibleOptions.length > 0 ? (
          visibleOptions.map((option) => {
            const color = colorFor?.(option.value)
            return (
              <label key={option.value} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
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

export function RemoveIconButton({ onClick, onHoverChange }: { onClick: () => void; onHoverChange?: (hovered: boolean) => void }) {
  const { t } = useI18n()
  return (
    <Button type="button" size="sm" variant="outline" className="absolute right-2 top-2 h-7 px-2 hover:bg-red-500" onClick={onClick} onMouseEnter={() => onHoverChange?.(true)} onMouseLeave={() => onHoverChange?.(false)} aria-label={t('remove')} title={t('remove')}>
      ✕
    </Button>
  )
}

export function DuplicateIconButton({ onClick, onHoverChange }: { onClick: () => void; onHoverChange?: (hovered: boolean) => void }) {
  const { t } = useI18n()
  return (
    <Button type="button" size="sm" variant="outline" className="absolute right-2 top-10 h-7 px-2 hover:bg-blue-500" onClick={onClick} onMouseEnter={() => onHoverChange?.(true)} onMouseLeave={() => onHoverChange?.(false)} aria-label={t('duplicate')} title={t('duplicate')}>
      ⧉
    </Button>
  )
}

/**
 * Color input that either references a material color (select + small preview of the resolved
 * color) or holds a custom #hex color (picker). A plain color name such as "aqua" is shown in the
 * material select as its own entry, so existing configs display correctly.
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
  const switchMode = () => {
    if (isCustom) {
      onChange(materialNames[0] ?? 'default')
      return
    }
    // Start the custom color from the currently shown color when it is a hex value.
    const current = resolvePreviewColor(trimmed, materialColors)
    onChange(current && /^#[0-9a-f]{6}$/i.test(current) ? current : '#000000')
  }

  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2">
      <Button type="button" variant="outline" onClick={switchMode}>
        {isCustom ? t('colorModeCustom') : t('colorModeMaterial')}
      </Button>
      {isCustom ? (
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <Input type="color" value={/^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : '#000000'} className="w-16 p-1" onChange={(e) => onChange(e.target.value)} />
          <Input value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      ) : (
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <ColorSwatch color={resolvePreviewColor(trimmed, materialColors)} title={materialColors[trimmed] ?? trimmed} />
          <Select value={trimmed} onChange={(e) => onChange(e.target.value)}>
            {options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        </div>
      )}
    </div>
  )
}
