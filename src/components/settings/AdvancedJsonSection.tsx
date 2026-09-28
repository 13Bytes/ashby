import type { FrameConfig } from '../../config/defaultPlotConfig'
import { useI18n } from '../../uiTranslations'
import { parseJsonField } from '../../utils/configIo'
import { DraftInput, Field } from '../common/AppControls'

type Props = {
  activeFrame: FrameConfig
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
}

export function AdvancedJsonSection({ activeFrame, patchActiveFrame }: Props) {
  const { t } = useI18n()
  return (
    <div className="grid gap-4 @lg:grid-cols-2">
      <Field label={t('filter')} jsonPath="filter" level="default" changed={Object.keys(activeFrame.filter ?? {}).length > 0}>
        <DraftInput
          multiline
          value={JSON.stringify(activeFrame.filter ?? {}, null, 2)}
          parse={(text) => parseJsonField<Record<string, unknown>>(text, {})}
          onCommit={(filter) => patchActiveFrame((f) => ({ ...f, filter }))}
        />
      </Field>
      <Field label={t('highlightedHulls')} jsonPath="highlighted_hulls" level="default" changed={activeFrame.highlightedHulls.length > 0}>
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
    </div>
  )
}
