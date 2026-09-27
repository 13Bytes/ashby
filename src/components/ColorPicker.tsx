import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../uiTranslations'
import { hexToHsv, hsvToHex, parseHexInput, type Hsv } from '../utils/colors'

const HEX_PATTERN = /^#[0-9a-f]{6}$/i
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

/** Standard palette offered below the picker (Tableau 10 and greys). */
const PALETTE = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac', '#000000', '#555555', '#999999', '#dddddd', '#ffffff']

const POPOVER_WIDTH = 240
const POPOVER_HEIGHT = 420

type EyeDropperWindow = Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }

/**
 * Round color swatch that opens a color picker popup: saturation/brightness area, hue slider,
 * hex field, colors already used in the dataset and a standard palette. The same popup in every
 * browser (the native color input opens the operating system dialog in Firefox).
 */
export function ColorDot({ value, onChange, label, size = 'md', presets = [] }: { value: string; onChange: (next: string) => void; label: string; size?: 'sm' | 'md'; presets?: string[] }) {
  const hex = HEX_PATTERN.test(value) ? value.toLowerCase() : '#000000'
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const close = useCallback(() => setPosition(null), [])

  const toggle = () => {
    if (position) {
      setPosition(null)
      return
    }
    const rect = triggerRef.current!.getBoundingClientRect()
    const left = clamp(rect.left - 8, 8, window.innerWidth - POPOVER_WIDTH - 8)
    const below = rect.bottom + 6
    const top = below + POPOVER_HEIGHT > window.innerHeight - 8 ? Math.max(8, rect.top - POPOVER_HEIGHT - 6) : below
    setPosition({ left, top })
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={position !== null}
        title={`${label}: ${hex}`}
        className={`inline-block shrink-0 cursor-pointer rounded-full ring-1 ring-inset ring-black/15 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:ring-white/20 ${position ? 'ring-2 ring-violet-500' : ''} ${size === 'sm' ? 'h-5 w-5' : 'h-7 w-7'}`}
        style={{ backgroundColor: hex }}
      />
      {position
        ? createPortal(
            <ColorPopover
              initial={hex}
              label={label}
              presets={presets}
              left={position.left}
              top={position.top}
              triggerRef={triggerRef}
              onChange={onChange}
              onClose={close}
            />,
            document.body,
          )
        : null}
    </>
  )
}

function ColorPopover({ initial, label, presets, left, top, triggerRef, onChange, onClose }: {
  initial: string
  label: string
  presets: string[]
  left: number
  top: number
  triggerRef: RefObject<HTMLElement | null>
  onChange: (next: string) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(initial))
  const [hexDraft, setHexDraft] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  // The area or hue slider being dragged.
  const draggingRef = useRef<HTMLElement | null>(null)
  const hex = hsvToHex(hsv)
  const used = [...new Set(presets.filter((entry) => HEX_PATTERN.test(entry)).map((entry) => entry.toLowerCase()))].slice(0, 20)
  const eyeDropper = (window as EyeDropperWindow).EyeDropper

  // Closes on a click outside, Escape, and when the page scrolls or resizes (the popup is fixed).
  useEffect(() => {
    const outside = (event: globalThis.PointerEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !triggerRef.current?.contains(target)) onClose()
    }
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const scroll = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose, triggerRef])

  const commit = (next: Hsv) => {
    setHsv(next)
    setHexDraft(null)
    onChange(hsvToHex(next))
  }
  const pick = (color: string) => {
    // Keep the hue when a grey is picked, so the area does not jump to red.
    const next = hexToHsv(color)
    commit(next.s === 0 ? { ...next, h: hsv.h } : next)
  }

  /** Drag handling for the area and the hue slider: live preview while dragging, saved on release. */
  const dragHandlers = (fromPointer: (rect: DOMRect, x: number, y: number) => Hsv) => ({
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      draggingRef.current = event.currentTarget
      // Keeps the drag going when the pointer leaves the element.
      if (event.isTrusted) event.currentTarget.setPointerCapture(event.pointerId)
      setHsv(fromPointer(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY))
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (draggingRef.current !== event.currentTarget) return
      setHsv(fromPointer(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY))
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      if (draggingRef.current !== event.currentTarget) return
      draggingRef.current = null
      commit(fromPointer(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY))
    },
    onPointerCancel: () => {
      draggingRef.current = null
    },
  })
  const area = dragHandlers((rect, x, y) => ({ h: hsv.h, s: clamp((x - rect.left) / rect.width), v: clamp(1 - (y - rect.top) / rect.height) }))
  const hue = dragHandlers((rect, x) => ({ ...hsv, h: clamp((x - rect.left) / rect.width) * 359.9 }))

  const areaKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.02
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: clamp(hsv.s - step) },
      ArrowRight: { s: clamp(hsv.s + step) },
      ArrowUp: { v: clamp(hsv.v + step) },
      ArrowDown: { v: clamp(hsv.v - step) },
    }
    if (!moves[event.key]) return
    event.preventDefault()
    commit({ ...hsv, ...moves[event.key] })
  }
  const hueKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 30 : 5
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    commit({ ...hsv, h: clamp(hsv.h + (event.key === 'ArrowRight' ? step : -step), 0, 359.9) })
  }

  const applyHexDraft = () => {
    if (hexDraft === null) return
    const parsed = parseHexInput(hexDraft)
    if (parsed) pick(parsed)
    else setHexDraft(null)
  }

  const swatch = (color: string) => (
    <button
      key={color}
      type="button"
      onClick={() => pick(color)}
      title={color}
      aria-label={color}
      className={`h-5 w-5 rounded-full ring-1 ring-inset ring-black/15 transition-transform hover:scale-115 dark:ring-white/20 ${color === hex ? 'outline-2 outline-offset-1 outline-violet-500' : ''}`}
      style={{ backgroundColor: color }}
    />
  )

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={label}
      style={{ left, top, width: POPOVER_WIDTH }}
      className="fixed z-50 grid gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-700 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      <div
        {...area}
        role="slider"
        tabIndex={0}
        aria-label={t('colorArea')}
        aria-valuetext={hex}
        onKeyDown={areaKeys}
        className="relative h-36 cursor-crosshair touch-none rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)`, backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)' }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_1px_3px_rgb(0_0_0/0.4)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hex }}
        />
      </div>
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full ring-1 ring-inset ring-black/15 dark:ring-white/20" style={{ backgroundColor: hex }} />
        <div
          {...hue}
          role="slider"
          tabIndex={0}
          aria-label={t('colorHue')}
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(hsv.h)}
          onKeyDown={hueKeys}
          className="relative h-3 flex-1 cursor-pointer touch-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
          style={{ backgroundImage: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_1px_3px_rgb(0_0_0/0.4)]"
            style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={hexDraft ?? hex}
          onChange={(event) => setHexDraft(event.target.value)}
          onBlur={applyHexDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') applyHexDraft()
          }}
          spellCheck={false}
          aria-label={t('hexColor')}
          className="h-8 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 font-mono text-xs uppercase text-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        {eyeDropper ? (
          <button
            type="button"
            title={t('pickFromScreen')}
            aria-label={t('pickFromScreen')}
            onClick={() => {
              new eyeDropper().open().then((result) => pick(result.sRGBHex.toLowerCase())).catch(() => undefined)
            }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-zinc-300 text-zinc-600 hover:text-violet-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-violet-300"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M13.5 3.5a2 2 0 0 1 2.8 2.8l-1.8 1.8.7.7-1.4 1.4-4.2-4.2 1.4-1.4.7.7z" />
              <path d="M10.8 7.4L4.5 13.7 4 16l2.3-.5 6.3-6.3" />
            </svg>
          </button>
        ) : null}
      </div>
      {used.length > 0 ? (
        <div className="grid gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">{t('usedColors')}</span>
          <div className="flex flex-wrap gap-1.5">{used.map(swatch)}</div>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">{t('paletteColors')}</span>
        <div className="flex flex-wrap gap-1.5">{PALETTE.map(swatch)}</div>
      </div>
    </div>
  )
}
