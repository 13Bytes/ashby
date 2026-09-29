import type { PointerEvent as ReactPointerEvent } from 'react'

type Props = {
  label: string
  hint: string
  width: number
  /** Width of the resized column for the pointer at this x position. */
  widthAt: (clientX: number) => number
  /** Arrow key that makes the column wider. */
  growKey: 'ArrowLeft' | 'ArrowRight'
  /** While dragging. */
  onResize: (width: number) => void
  /** After dragging, per arrow key and on double-click (the default width). */
  onCommit: (width: number) => void
  defaultWidth: number
  /** A 1px line with a wider invisible grab area instead of the 9px bar with a grip. */
  thin?: boolean
}

/** Vertical divider between columns, dragged or moved with the arrow keys; only on wide screens. */
export function ResizeDivider({ label, hint, width, widthAt, growKey, onResize, onCommit, defaultWidth, thin = false }: Props) {
  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const move = (moveEvent: PointerEvent) => onResize(widthAt(moveEvent.clientX))
    const stop = (upEvent: PointerEvent) => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
      onCommit(widthAt(upEvent.clientX))
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      tabIndex={0}
      title={hint}
      onPointerDown={startResize}
      onDoubleClick={() => onCommit(defaultWidth)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          onCommit(width + (event.key === growKey ? 24 : -24))
        }
      }}
      className={thin
        ? 'group relative z-10 hidden cursor-col-resize touch-none bg-zinc-200 hover:bg-brand-500 focus-visible:bg-brand-500 focus-visible:outline-none lg:block dark:bg-zinc-800 dark:hover:bg-brand-500'
        : 'group hidden cursor-col-resize touch-none place-items-center border-x border-zinc-200 bg-zinc-100 focus-visible:outline-none lg:grid dark:border-zinc-800 dark:bg-zinc-900'}
    >
      {thin
        ? <span className="absolute inset-y-0 -left-1 -right-1" />
        : <span className="h-10 w-1 rounded-full bg-zinc-300 group-hover:bg-brand-500 group-focus-visible:bg-brand-500 dark:bg-zinc-700" />}
    </div>
  )
}
