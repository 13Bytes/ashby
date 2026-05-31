import { useState, type ReactNode } from 'react'
import { FIELD_DESCRIPTIONS, type UILanguage } from '../uiTranslations'
import type { MultiOption } from '../utils/appState'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'

export function Field({
  label,
  jsonPath,
  selfClassName,
  className,
  language,
  children,
}: {
  label: string
  jsonPath: string
  selfClassName?: string
  className?: string
  language: UILanguage
  children: ReactNode
}) {
  const description = FIELD_DESCRIPTIONS[language].find((entry) => entry.match.test(jsonPath))?.description
  const tooltip = description ? `${jsonPath}\n${description}` : jsonPath
  return (
    <div className={`grid gap-2 ${selfClassName || ''}`}>
      <label title={tooltip} className="font-medium text-zinc-900 dark:text-zinc-100">{label}</label>
      <div className={`grid gap-2 ${className || ''}`}>
        {children}
      </div>
    </div>
  )
}

export function MultiSelectInput({
  value,
  options,
  title,
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
  onChange: (next: string[]) => void
  expanded?: boolean
  onToggleExpanded?: () => void
  hideModeToggle?: boolean
  modeValue?: boolean
  onModeChange?: (next: boolean) => void
}) {
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
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setShowSearch((current) => !current)}>
            {showSearch ? 'Hide search' : 'Search'}
          </Button>
          {!hideModeToggle && onModeChange ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onModeChange(!(modeValue ?? false))}>
              {modeValue ? 'Whitelist' : 'Blacklist'}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(allSelected ? [] : options.map((entry) => entry.value))} disabled={options.length === 0}>
            {allSelected ? 'Deselect all' : 'Select all'}
          </Button>
          {onToggleExpanded ? (
            <Button type="button" size="sm" variant="outline" onClick={onToggleExpanded}>
              {expanded ? 'Collapse' : 'Expand'}
            </Button>
          ) : null}
        </div>
      </div>
      {showSearch ? (
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search options…"
        />
      ) : null}
      <div className={`${expanded ? 'h-full min-h-28' : 'h-47'} overflow-auto rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900`}>
        {visibleOptions.length > 0 ? (
          visibleOptions.map((option) => (
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
              <span>{option.label}</span>
            </label>
          ))
        ) : (
          <p className="m-0 py-1 text-sm text-zinc-500">{options.length === 0 ? 'No options available.' : 'No search results.'}</p>
        )}
      </div>
    </div>
  )
}

export function RemoveIconButton({ onClick, onHoverChange }: { onClick: () => void; onHoverChange?: (hovered: boolean) => void }) {
  return (
    <Button type="button" size="sm" variant="outline" className="absolute right-2 top-2 h-7 px-2 hover:bg-red-500" onClick={onClick} onMouseEnter={() => onHoverChange?.(true)} onMouseLeave={() => onHoverChange?.(false)} aria-label="Remove">
      ✕
    </Button>
  )
}

export function ColorOrMaterialInput({
  value,
  onChange,
  materialOptions,
}: {
  value: string
  onChange: (next: string) => void
  materialOptions: string[]
}) {
  const isHexColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
  const mode: 'custom' | 'existing' = isHexColor ? 'custom' : 'existing'
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2">
      <Button type="button" variant="outline" onClick={() => onChange(mode === 'custom' ? (materialOptions[0] ?? 'default') : '#000000')}>
        {mode}
      </Button>
      {mode === 'custom' ? (
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <Input type="color" value={isHexColor ? value : '#000000'} className="h-10 w-16 p-1" onChange={(e) => onChange(e.target.value)} />
          <Input value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      ) : (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          {materialOptions.map((materialOption) => (
            <option key={materialOption} value={materialOption}>{materialOption}</option>
          ))}
        </Select>
      )}
    </div>
  )
}
