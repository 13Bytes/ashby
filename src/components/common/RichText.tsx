import type { ReactNode } from 'react'
import type { RichText as RichTextParts } from '../../content/overviewContent'
import { cn } from '../../lib/utils'

/** A link to another site (new tab) or a mailto link. */
export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const external = href.startsWith('http')
  return (
    <a
      className={cn('font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-brand-700 hover:decoration-brand-400 dark:text-zinc-200 dark:decoration-zinc-600 dark:hover:text-brand-300', className)}
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

/** Renders text whose linked parts are given as { text, href }. */
export function RichText({ parts }: { parts: RichTextParts }) {
  return (
    <>
      {parts.map((part, index) => (typeof part === 'string' ? part : <TextLink key={index} href={part.href}>{part.text}</TextLink>))}
    </>
  )
}
