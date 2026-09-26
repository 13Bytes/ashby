import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import type { DataframeConfig, FrameConfig, GuidelineConfig } from '../config/defaultPlotConfig'
import { useI18n } from '../uiTranslations'
import { numberValue } from '../utils/appState'
import { getLocalizedLabel, setLocalizedLabel } from '../utils/configEditing'
import { ColorOrMaterialInput, DuplicateIconButton, Field, RemoveIconButton, SectionHeading } from './AppControls'

type Props = {
  activeDataframe: DataframeConfig
  activeFrame: FrameConfig
  hoveredRemoveGroup: string | null
  setHoveredRemoveGroup: (value: string | null) => void
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  updateGuideline: (guidelineIndex: number, patch: (guideline: GuidelineConfig) => GuidelineConfig) => void
  addGuideline: () => void
  materialColors: Record<string, string>
}

const LINE_STYLE_OPTIONS = ['-', '--', '-.', ':', 'None']

export function GuidelinesSection({ activeDataframe, activeFrame, hoveredRemoveGroup, setHoveredRemoveGroup, patchActiveFrame, updateGuideline, addGuideline, materialColors }: Props) {
  const { t } = useI18n()
  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent">
      <div className="flex items-center gap-2">
        <SectionHeading title={t('guidelines')} jsonPath="guidelines" />
        <Button variant="outline" size="sm" onClick={addGuideline}>+ {t('guideline')}</Button>
      </div>
      {activeFrame.guidelines.map((guideline, guidelineIndex) => (
        <div key={guidelineIndex} className={`relative grid gap-2 rounded-lg border p-2 pr-15 sm:col-span-2 sm:grid-cols-3 ${hoveredRemoveGroup === `guideline-${guidelineIndex}` ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}>
          <DuplicateIconButton onClick={() => patchActiveFrame((f) => (
            { ...f, guidelines: [...f.guidelines.slice(0, guidelineIndex + 1), structuredClone(f.guidelines[guidelineIndex]), ...f.guidelines.slice(guidelineIndex + 1)] }))} />
          <RemoveIconButton onHoverChange={(hovered) => setHoveredRemoveGroup(hovered ? `guideline-${guidelineIndex}` : null)} onClick={() => patchActiveFrame((f) => (
            { ...f, guidelines: f.guidelines.filter((_, i) => i !== guidelineIndex) }))} />

          <Field label={t('guidelineX')} jsonPath={`guidelines[${guidelineIndex}].x`}>
            <Input type="number" value={guideline.x ?? ''} onChange={(e) => updateGuideline(guidelineIndex, (g) => (
              { ...g, x: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} />
          </Field>
          <Field label={t('guidelineY')} jsonPath={`guidelines[${guidelineIndex}].y`}>
            <Input type="number" value={guideline.y ?? ''} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, y: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} />
          </Field>
          <Field label={t('guidelineSlope')} jsonPath={`guidelines[${guidelineIndex}].m`}>
            <Input type="number" value={guideline.m} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, m: numberValue(e.target.valueAsNumber, g.m) }))} />
          </Field>
          <Field label={t('color')} jsonPath={`guidelines[${guidelineIndex}].line_props.color`}>
            <ColorOrMaterialInput materialColors={materialColors} value={guideline.lineProps.color} onChange={(next) => updateGuideline(guidelineIndex, (g) => (
              { ...g, lineProps: { ...g.lineProps, color: next } }))} />
          </Field>
          <Field label={t('lineStyle')} jsonPath={`guidelines[${guidelineIndex}].line_props.linestyle`}>
            <Select value={guideline.lineProps.linestyle} onChange={(e) => updateGuideline(guidelineIndex, (g) => (
              { ...g, lineProps: { ...g.lineProps, linestyle: e.target.value } }))}>
              {LINE_STYLE_OPTIONS.map((option) => <option key={`linestyle-${option}`} value={option}>{option}</option>)}
            </Select>
          </Field>
          <Field label={t('lineWidth')} jsonPath={`guidelines[${guidelineIndex}].line_props.linewidth`}>
            <Input type="number" value={guideline.lineProps.linewidth} onChange={(e) => updateGuideline(guidelineIndex, (g) => (
              { ...g, lineProps: { ...g.lineProps, linewidth: numberValue(e.target.valueAsNumber, g.lineProps.linewidth) } }))} />
          </Field>
          <div className="relative grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <Field label={t('fontColor')} jsonPath={`guidelines[${guidelineIndex}].font_color`}>
              <ColorOrMaterialInput materialColors={materialColors} value={guideline.fontColor} onChange={(next) => updateGuideline(guidelineIndex, (g) => ({ ...g, fontColor: next }))} />
            </Field>
            <Field label={t('fontSize')} jsonPath={`guidelines[${guidelineIndex}].fontsize`}>
              <Input type="number" value={guideline.fontsize} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, fontsize: numberValue(e.target.valueAsNumber, g.fontsize) }))} />
            </Field>
            <Field label={t('labelPadding')} jsonPath={`guidelines[${guidelineIndex}].label_padding`}>
              <Input type="number" value={guideline.labelPadding} onChange={(e) => updateGuideline(guidelineIndex, (g) => (
                { ...g, labelPadding: numberValue(e.target.valueAsNumber, g.labelPadding) }))} />
            </Field>
            <Field label={t('labelPosition')} jsonPath={`guidelines[${guidelineIndex}].label_above`}>
              <Button type="button" variant="outline" onClick={() => updateGuideline(guidelineIndex, (g) => ({ ...g, labelAbove: !g.labelAbove }))}>
                {guideline.labelAbove ? t('above') : t('below')}
              </Button>
            </Field>
          </div>

          <Field label={t('text')} jsonPath={`guidelines[${guidelineIndex}].label`}>
            {activeDataframe.plotLanguages.map((lang) => (
              <div key={`label-${lang}`} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2">
                <span className="text-xs uppercase text-zinc-600 dark:text-zinc-300">{lang}</span>
                <Input
                  value={getLocalizedLabel(guideline.label, lang)}
                  onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, label: setLocalizedLabel(g.label, lang, e.target.value, activeDataframe.plotLanguages) }))}
                />
              </div>
            ))}
          </Field>
        </div>
      ))}
    </section>
  )
}
