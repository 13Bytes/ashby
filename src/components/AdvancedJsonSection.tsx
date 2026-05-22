import type { FrameConfig } from '../config/defaultPlotConfig'
import type { UILanguage } from '../uiTranslations'

type Props = {
  t: (key: string) => string
  uiLanguage: UILanguage
  activeFrame: FrameConfig
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  parseJsonField: <T>(raw: string, fallback: T) => T
  FieldComponent: any
}

export function AdvancedJsonSection({ t, uiLanguage, activeFrame, patchActiveFrame, parseJsonField, FieldComponent: Field }: Props) {
  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
      <h3 className="sm:col-span-2 text-sm font-semibold">{t('advancedJsonFields')}</h3>
      <Field language={uiLanguage} label="Filter" jsonPath="filter"><textarea className="min-h-24 rounded-md border border-zinc-300 bg-white p-2 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" value={JSON.stringify(activeFrame.filter ?? {}, null, 2)} onChange={(e) => patchActiveFrame((f) => ({ ...f, filter: parseJsonField<Record<string, unknown>>(e.target.value, f.filter ?? {}) }))} /></Field>
      <Field language={uiLanguage} label="Highlighted hulls" jsonPath="highlighted_hulls"><textarea className="min-h-24 rounded-md border border-zinc-300 bg-white p-2 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" value={JSON.stringify(activeFrame.highlightedHulls, null, 2)} onChange={(e) => patchActiveFrame((f) => ({ ...f, highlightedHulls: parseJsonField(e.target.value, f.highlightedHulls) }))} /></Field>
    </section>
  )
}
