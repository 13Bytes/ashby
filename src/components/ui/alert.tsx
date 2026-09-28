import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const alertVariants = cva('w-full rounded-lg border p-3 text-sm', {
  variants: {
    variant: {
      default:     'border-zinc-300 bg-zinc-50 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
      success:     'border-green-300 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/50 dark:text-green-100',
      warning:     'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100',
      destructive: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

/**
 * Notice that closes itself after `seconds`, paused while the pointer is on it or it has focus. A thin
 * bar along the bottom shows the time left. A new `resetKey` (e.g. a new message) starts the time again.
 */
export function TimedAlert({ variant, seconds, onClose, closeLabel, resetKey, children }: {
  variant: VariantProps<typeof alertVariants>['variant']
  seconds: number
  onClose: () => void
  closeLabel: string
  resetKey?: unknown
  children: React.ReactNode
}) {
  const barRef = React.useRef<HTMLDivElement>(null)
  const onCloseRef = React.useRef(onClose)
  const remaining = React.useRef(seconds * 1000)
  const [hovered, setHovered] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const paused = hovered || focused
  React.useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  // A new message starts the full time again, bar included.
  React.useEffect(() => {
    remaining.current = seconds * 1000
    const bar = barRef.current
    if (!bar) return
    bar.style.animationName = 'none'
    void bar.offsetWidth // restarts the animation
    bar.style.animationName = ''
  }, [resetKey, seconds])
  // The timer closes the notice; the bar only shows the time left.
  React.useEffect(() => {
    if (paused) return
    const startedAt = Date.now()
    const timer = window.setTimeout(() => onCloseRef.current(), remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current -= Date.now() - startedAt
    }
  }, [paused, resetKey, seconds])
  return (
    <Alert
      variant={variant}
      className="relative flex items-center justify-between gap-3 overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}
    >
      <span>{children}</span>
      <button type="button" className="rounded px-1 text-sm leading-none hover:bg-black/10 dark:hover:bg-white/10" onClick={onClose} aria-label={closeLabel}>✕</button>
      <div
        ref={barRef}
        aria-hidden="true"
        className="notice-timer absolute inset-x-0 bottom-0 h-0.5 origin-left bg-current opacity-30"
        style={{ '--notice-seconds': `${seconds}s`, animationPlayState: paused ? 'paused' : 'running' } as React.CSSProperties}
      />
    </Alert>
  )
}

export function Alert({ className, variant, children, ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div role="status" className={cn(alertVariants({ variant }), className)} {...props}>
      {children}
    </div>
  )
}
