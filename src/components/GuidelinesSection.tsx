import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import type { DataframeConfig, FrameConfig, GuidelineConfig } from '../config/defaultPlotConfig'
import { DEFAULT_GUIDELINE } from '../config/settingsSections'
import { useI18n } from '../uiTranslations'
import { numberValue } from '../utils/appState'
import { getLocalizedLabel, setLocalizedLabel } from '../utils/configEditing'
import { ColorOrMaterialInput, EmptyItems, Field, ItemCard, LanguageFields, Segmented, SettingsGroup } from './AppControls'
import { useOpenItems } from '../hooks/useOpenItems'

type Props = {
  activeDataframe: DataframeConfig
  activeFrame: FrameConfig
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  updateGuideline: (guidelineIndex: number, patch: (guideline: GuidelineConfig) => GuidelineConfig) => void
  addGuideline: () => void
  materialColors: Record<string, string>
}

const LINE_STYLE_OPTIONS = ['-', '--', '-.', ':', 'None']

/** Guidelines of the active frame, as a group of the "Areas, guidelines & annotations" section. */
export function GuidelinesSection({ activeDataframe, activeFrame, patchActiveFrame, updateGuideline, addGuideline, materialColors }: Props) {
  const { t } = useI18n()
  const language = activeDataframe.language
  const openItems = useOpenItems(String(activeFrame._extensions.uiKey))
  return (
    <SettingsGroup
      title={<>{t('guidelines')} <span className="ml-1 font-sans normal-case tracking-normal text-zinc-400">{activeFrame.guidelines.length}</span></>}
      actions={<Button variant="outline" size="sm" data-always onClick={() => {
        openItems.added(activeFrame.guidelines.length)
        addGuideline()
      }}>+ {t('guideline')}</Button>}
    >
      <div className="grid gap-2">
        {activeFrame.guidelines.length === 0 ? <EmptyItems>{t('noItems')}</EmptyItems> : null}
        {activeFrame.guidelines.map((guideline, guidelineIndex) => {
          const text = getLocalizedLabel(guideline.label, language)
          const anchor = [guideline.x, guideline.y].every((value) => value !== undefined) ? `(${guideline.x}, ${guideline.y})` : guideline.x !== undefined ? `x = ${guideline.x}` : guideline.y !== undefined ? `y = ${guideline.y}` : ''
          return (
            <ItemCard
              key={guidelineIndex}
              icon="╱"
              title={text || `${t('guideline')} ${guidelineIndex + 1}`}
              summary={[anchor, `m = ${guideline.m}`].filter(Boolean).join(' · ')}
              open={openItems.isOpen(guidelineIndex)}
              onOpenChange={(next) => openItems.setOpen(guidelineIndex, next)}
              onDuplicate={() => {
                openItems.inserted(guidelineIndex + 1)
                patchActiveFrame((f) => ({ ...f, guidelines: [...f.guidelines.slice(0, guidelineIndex + 1), structuredClone(f.guidelines[guidelineIndex]), ...f.guidelines.slice(guidelineIndex + 1)] }))
              }}
              onRemove={() => {
                openItems.removed(guidelineIndex)
                patchActiveFrame((f) => ({ ...f, guidelines: f.guidelines.filter((_, i) => i !== guidelineIndex) }))
              }}
            >
              <div className="grid gap-4 @lg:grid-cols-3">
                <Field label={t('guidelineX')} jsonPath={`guidelines[${guidelineIndex}].x`} level="check">
                  <Input type="number" value={guideline.x ?? ''} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, x: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} />
                </Field>
                <Field label={t('guidelineY')} jsonPath={`guidelines[${guidelineIndex}].y`} level="check">
                  <Input type="number" value={guideline.y ?? ''} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, y: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} />
                </Field>
                <Field label={t('guidelineSlope')} jsonPath={`guidelines[${guidelineIndex}].m`} level="check">
                  <Input type="number" value={guideline.m} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, m: numberValue(e.target.valueAsNumber, g.m) }))} />
                </Field>
                <Field label={t('lineStyle')} jsonPath={`guidelines[${guidelineIndex}].line_props.linestyle`} level="default" changed={guideline.lineProps.linestyle !== DEFAULT_GUIDELINE.lineProps.linestyle}>
                  <Select value={guideline.lineProps.linestyle} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, lineProps: { ...g.lineProps, linestyle: e.target.value } }))}>
                    {LINE_STYLE_OPTIONS.map((option) => <option key={`linestyle-${option}`} value={option}>{option}</option>)}
                  </Select>
                </Field>
                <Field label={t('lineWidth')} jsonPath={`guidelines[${guidelineIndex}].line_props.linewidth`} level="default" changed={guideline.lineProps.linewidth !== DEFAULT_GUIDELINE.lineProps.linewidth}>
                  <Input type="number" value={guideline.lineProps.linewidth} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, lineProps: { ...g.lineProps, linewidth: numberValue(e.target.valueAsNumber, g.lineProps.linewidth) } }))} />
                </Field>
                <Field label={t('color')} jsonPath={`guidelines[${guidelineIndex}].line_props.color`} level="check">
                  <ColorOrMaterialInput materialColors={materialColors} value={guideline.lineProps.color} onChange={(next) => updateGuideline(guidelineIndex, (g) => ({ ...g, lineProps: { ...g.lineProps, color: next } }))} />
                </Field>
              </div>
              <div className="grid gap-4 @lg:grid-cols-4">
                <div className="@lg:col-span-2">
                  <LanguageFields
                    label={t('text')}
                    jsonPath={`guidelines[${guidelineIndex}].label`}
                    level="check"
                    languages={activeDataframe.plotLanguages}
                    selectedLanguage={language}
                    value={(lang) => getLocalizedLabel(guideline.label, lang)}
                    onChange={(lang, next) => updateGuideline(guidelineIndex, (g) => ({ ...g, label: setLocalizedLabel(g.label, lang, next, activeDataframe.plotLanguages) }))}
                  />
                </div>
                <Field label={t('labelPosition')} jsonPath={`guidelines[${guidelineIndex}].label_above`} level="default" changed={guideline.labelAbove !== DEFAULT_GUIDELINE.labelAbove}>
                  <Segmented<'above' | 'below'>
                    ariaLabel={t('labelPosition')}
                    value={guideline.labelAbove ? 'above' : 'below'}
                    onChange={(next) => updateGuideline(guidelineIndex, (g) => ({ ...g, labelAbove: next === 'above' }))}
                    options={[{ value: 'above', label: t('above') }, { value: 'below', label: t('below') }]}
                  />
                </Field>
                <Field label={t('labelDirection')} jsonPath={`guidelines[${guidelineIndex}].label_rotated`} level="default" changed={guideline.labelRotated !== DEFAULT_GUIDELINE.labelRotated}>
                  <Segmented<'along' | 'horizontal'>
                    ariaLabel={t('labelDirection')}
                    value={guideline.labelRotated ? 'along' : 'horizontal'}
                    onChange={(next) => updateGuideline(guidelineIndex, (g) => ({ ...g, labelRotated: next === 'along' }))}
                    options={[{ value: 'along', label: t('alongLine') }, { value: 'horizontal', label: t('horizontal') }]}
                  />
                </Field>
              </div>
              <div className="grid gap-4 @lg:grid-cols-3">
                <Field label={t('fontSize')} jsonPath={`guidelines[${guidelineIndex}].fontsize`} level="default" changed={guideline.fontsize !== DEFAULT_GUIDELINE.fontsize}>
                  <Input type="number" value={guideline.fontsize} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, fontsize: numberValue(e.target.valueAsNumber, g.fontsize) }))} />
                </Field>
                <Field label={t('labelPadding')} jsonPath={`guidelines[${guidelineIndex}].label_padding`} level="default" changed={guideline.labelPadding !== DEFAULT_GUIDELINE.labelPadding}>
                  <Input type="number" value={guideline.labelPadding} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, labelPadding: numberValue(e.target.valueAsNumber, g.labelPadding) }))} />
                </Field>
                <Field label={t('fontColor')} jsonPath={`guidelines[${guidelineIndex}].font_color`} level="default" changed={Boolean(guideline.fontColor)}>
                  <ColorOrMaterialInput materialColors={materialColors} value={guideline.fontColor} onChange={(next) => updateGuideline(guidelineIndex, (g) => ({ ...g, fontColor: next }))} />
                </Field>
              </div>
            </ItemCard>
          )
        })}
      </div>
    </SettingsGroup>
  )
}
