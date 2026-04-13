import * as React from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, ...props }: React.ComponentProps<'article'>) {
  return <article className={cn('rounded-lg border border-zinc-200 p-3 dark:border-zinc-800', className)} {...props} />
}
