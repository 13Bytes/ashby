import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import type { FrameConfig, GuidelineConfig } from '../config/defaultPlotConfig'
import type { UILanguage } from '../uiTranslations'

type Props = {
  t: (key: string) => string
  uiLanguage: UILanguage
  activeFrame: FrameConfig
  hoveredRemoveGroup: string | null
  setHoveredRemoveGroup: (value: string | null) => void
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  updateGuideline: (guidelineIndex: number, patch: (guideline: GuidelineConfig) => GuidelineConfig) => void
  addGuideline: () => void
  materialColorOptions: string[]
  numberValue: (value: number, fallback: number) => number
  FieldComponent: any
  RemoveIconButtonComponent: any
  ColorOrMaterialInputComponent: any
}

export const addGuidelineToFrame = (frame: FrameConfig): FrameConfig => ({
  ...frame,
  guidelines: [...frame.guidelines, { m: 1, lineProps: { linestyle: '--', color: 'aqua', linewidth: 4 }, fontsize: 18, fontColor: '', label: '', labelAbove: true, labelPadding: 6 }],
})

export const updateGuidelineInFrame = (frame: FrameConfig, guidelineIndex: number, patch: (guideline: GuidelineConfig) => GuidelineConfig): FrameConfig => ({
  ...frame,
  guidelines: frame.guidelines.map((guideline, index) => (index === guidelineIndex ? patch(guideline) : guideline)),
})

const LINE_STYLE_OPTIONS = ['-', '--', '-.', ':', 'None']

export function GuidelinesSection({ t, uiLanguage, activeFrame, hoveredRemoveGroup, setHoveredRemoveGroup, patchActiveFrame, updateGuideline, addGuideline, materialColorOptions, numberValue, FieldComponent: Field, RemoveIconButtonComponent: RemoveIconButton, ColorOrMaterialInputComponent: ColorOrMaterialInput }: Props) {
  return <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold">{t('guidelines')}</h3><Button variant="outline" size="sm" onClick={addGuideline}>+ Guideline</Button></div>{activeFrame.guidelines.map((guideline, guidelineIndex) => (<div key={guidelineIndex} className={`relative grid gap-2 rounded-lg border p-3 pr-12 sm:col-span-2 sm:grid-cols-2 ${hoveredRemoveGroup === `guideline-${guidelineIndex}` ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}><RemoveIconButton onHoverChange={(hovered: boolean) => setHoveredRemoveGroup(hovered ? `guideline-${guidelineIndex}` : null)} onClick={() => patchActiveFrame((f) => ({ ...f, guidelines: f.guidelines.filter((_, i) => i !== guidelineIndex) }))} /><Field language={uiLanguage} label="x" jsonPath={`guidelines[${guidelineIndex}].x`}><Input type="number" value={guideline.x ?? ''} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, x: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} /></Field><Field language={uiLanguage} label="y" jsonPath={`guidelines[${guidelineIndex}].y`}><Input type="number" value={guideline.y ?? ''} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, y: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} /></Field><Field language={uiLanguage} label="m" jsonPath={`guidelines[${guidelineIndex}].m`}><Input type="number" value={guideline.m} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, m: numberValue(e.target.valueAsNumber, g.m) }))} /></Field><Field language={uiLanguage} label="line_props.linestyle" jsonPath={`guidelines[${guidelineIndex}].line_props.linestyle`}><Select value={guideline.lineProps.linestyle} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, lineProps: { ...g.lineProps, linestyle: e.target.value } }))}>{LINE_STYLE_OPTIONS.map((option) => <option key={`linestyle-${option || 'empty'}`} value={option}>{option === '' ? 'empty string' : option === ' ' ? 'space' : option}</option>)}</Select></Field><Field language={uiLanguage} label="line_props.color" jsonPath={`guidelines[${guidelineIndex}].line_props.color`}><ColorOrMaterialInput materialOptions={materialColorOptions} value={guideline.lineProps.color} onChange={(next: string) => updateGuideline(guidelineIndex, (g) => ({ ...g, lineProps: { ...g.lineProps, color: next } }))} /></Field><Field language={uiLanguage} label="line_props.linewidth" jsonPath={`guidelines[${guidelineIndex}].line_props.linewidth`}><Input type="number" value={guideline.lineProps.linewidth} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, lineProps: { ...g.lineProps, linewidth: numberValue(e.target.valueAsNumber, g.lineProps.linewidth) } }))} /></Field><Field language={uiLanguage} label="fontsize" jsonPath={`guidelines[${guidelineIndex}].fontsize`}><Input type="number" value={guideline.fontsize} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, fontsize: numberValue(e.target.valueAsNumber, g.fontsize) }))} /></Field><Field language={uiLanguage} label="font_color" jsonPath={`guidelines[${guidelineIndex}].font_color`}><ColorOrMaterialInput materialOptions={materialColorOptions} value={guideline.fontColor} onChange={(next: string) => updateGuideline(guidelineIndex, (g) => ({ ...g, fontColor: next }))} /></Field><Field language={uiLanguage} label="label" jsonPath={`guidelines[${guidelineIndex}].label`}><Input value={guideline.label} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, label: e.target.value }))} /></Field><Field language={uiLanguage} label="label_above" jsonPath={`guidelines[${guidelineIndex}].label_above`}><Select value={guideline.labelAbove ? 'true' : 'false'} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, labelAbove: e.target.value === 'true' }))}><option value="true">true</option><option value="false">false</option></Select></Field><Field language={uiLanguage} label="label_padding" jsonPath={`guidelines[${guidelineIndex}].label_padding`}><Input type="number" value={guideline.labelPadding} onChange={(e) => updateGuideline(guidelineIndex, (g) => ({ ...g, labelPadding: numberValue(e.target.valueAsNumber, g.labelPadding) }))} /></Field></div>))}</section>
}
