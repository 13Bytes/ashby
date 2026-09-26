import type { FrameConfig } from '../config/defaultPlotConfig'
import type { UILanguage } from '../uiTranslations'
import { parseJsonField } from '../utils/configIo'
import { DraftInput, Field } from './AppControls'

type Props = {
  t: (key: string) => string
  uiLanguage: UILanguage
  activeFrame: FrameConfig
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
}

export function AdvancedJsonSection({ t, uiLanguage, activeFrame, patchActiveFrame }: Props) {
  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
      <h3 className="sm:col-span-2 m-0 text-m font-semibold text-violet-500">{t('advancedJsonFields')}</h3>
      <Field language={uiLanguage} label="Filter" jsonPath="filter">
        <DraftInput
          multiline
          value={JSON.stringify(activeFrame.filter ?? {}, null, 2)}
          parse={(text) => parseJsonField<Record<string, unknown>>(text, {})}
          onCommit={(filter) => patchActiveFrame((f) => ({ ...f, filter }))}
        />
      </Field>
      <Field language={uiLanguage} label="Highlighted hulls" jsonPath="highlighted_hulls">
        <DraftInput
          multiline
          value={JSON.stringify(activeFrame.highlightedHulls, null, 2)}
          parse={(text) => {
            const parsed = parseJsonField<FrameConfig['highlightedHulls']>(text, [])
            return Array.isArray(parsed) ? parsed : undefined
          }}
          onCommit={(highlightedHulls) => patchActiveFrame((f) => ({ ...f, highlightedHulls }))}
        />
      </Field>
    </section>
  )
}
