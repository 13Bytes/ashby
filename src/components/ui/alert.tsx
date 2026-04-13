import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const alertVariants = cva('w-full rounded-lg border p-3 text-sm', {
  variants: {
    variant: {
      default: 'border-zinc-300 bg-zinc-50 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
      success: 'border-green-300 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/50 dark:text-green-100',
      destructive: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export function Alert({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div role="status" className={cn(alertVariants({ variant }), className)} {...props} />
}
