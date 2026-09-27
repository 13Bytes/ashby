import type { AnnotationConfig, DataframeConfig, FrameConfig } from '../config/defaultPlotConfig'
import { DEFAULT_ANNOTATION_ARROW, DEFAULT_ANNOTATION_MARKER, DEFAULT_ANNOTATION_TEXT } from '../config/settingsSections'
import { useI18n } from '../uiTranslations'
import { numberValue, positiveValue } from '../utils/appState'
import { addAnnotationToFrame, DEFAULT_ANNOTATION_SETTINGS, getLocalizedLabel, setLocalizedLabel } from '../utils/configEditing'
import { ColorOrMaterialInput, EmptyItems, Field, ItemCard, LanguageFields, SettingsGroup, Toggle } from './AppControls'
import { useOpenItems } from '../hooks/useOpenItems'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'

const MARKER_SYMBOL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '.', label: 'point' },
  { value: ',', label: 'pixel' },
  { value: 'o', label: 'circle' },
  { value: 'v', label: 'triangle_down' },
  { value: '^', label: 'triangle_up' },
  { value: '<', label: 'triangle_left' },
  { value: '>', label: 'triangle_right' },
  { value: '1', label: 'tri_down' },
  { value: '2', label: 'tri_up' },
  { value: '3', label: 'tri_left' },
  { value: '4', label: 'tri_right' },
  { value: '8', label: 'octagon' },
  { value: 's', label: 'square' },
  { value: 'p', label: 'pentagon' },
  { value: 'P', label: 'plus_filled' },
  { value: '*', label: 'star' },
  { value: 'h', label: 'hexagon1' },
  { value: 'H', label: 'hexagon2' },
  { value: '+', label: 'plus' },
  { value: 'x', label: 'x' },
  { value: 'X', label: 'x_filled' },
  { value: 'D', label: 'diamond' },
  { value: 'd', label: 'thin_diamond' },
  { value: '|', label: 'vline' },
  { value: '_', label: 'hline' },
]

type AnnotationText = NonNullable<AnnotationConfig['text']>
type AnnotationMarker = NonNullable<AnnotationConfig['marker']>
type AnnotationArrow = NonNullable<AnnotationConfig['arrow']>

type Props = {
  activeDataframe: DataframeConfig
  activeFrame: FrameConfig
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  materialColors: Record<string, string>
}

/** Annotations of the active frame, as a group of the "Areas, guidelines & annotations" section. */
export function AnnotationsSection({ activeDataframe, activeFrame, patchActiveFrame, materialColors }: Props) {
  const { t } = useI18n()
  const language = activeDataframe.language
  const openItems = useOpenItems(String(activeFrame._extensions.uiKey))
  const patchAnnotation = (annotationIndex: number, patch: (annotation: AnnotationConfig) => AnnotationConfig) =>
    patchActiveFrame((f) => {
      // annotations[0] holds the defaults; create it if an older config has no annotations at all.
      const annotations = f.annotations.length > 0 ? f.annotations : [{ ...DEFAULT_ANNOTATION_SETTINGS }]
      return { ...f, annotations: annotations.map((entry, i) => (i === annotationIndex ? patch(entry) : entry)) }
    })
  const patchText = (annotationIndex: number, patch: Partial<AnnotationText>) =>
    patchAnnotation(annotationIndex, (entry) => ({ ...entry, text: { ...(entry.text ?? DEFAULT_ANNOTATION_TEXT), ...patch } }))
  const patchMarker = (annotationIndex: number, patch: Partial<AnnotationMarker>) =>
    patchAnnotation(annotationIndex, (entry) => ({ ...entry, marker: { ...(entry.marker ?? DEFAULT_ANNOTATION_MARKER), ...patch } }))
  const patchArrow = (annotationIndex: number, patch: Partial<AnnotationArrow>) =>
    patchAnnotation(annotationIndex, (entry) => ({ ...entry, arrow: { ...(entry.arrow ?? DEFAULT_ANNOTATION_ARROW), ...patch } }))
  const patchPosition = (annotationIndex: number, axisName: string, value: number) =>
    patchAnnotation(annotationIndex, (entry) => {
      const axes = { ...(entry.axes ?? {}) }
      if (Number.isFinite(value)) axes[axisName] = value
      else delete axes[axisName]
      return { ...entry, axes }
    })

  const defaults = activeFrame.annotations[0]
  const positionAxes = [activeFrame.xQuantity, activeFrame.yQuantity].filter((axis, index, all): axis is string => Boolean(axis) && all.indexOf(axis) === index)
  const count = Math.max(0, activeFrame.annotations.length - 1)

  return (
    <SettingsGroup
      title={<>{t('annotations')} <span className="ml-1 font-sans normal-case tracking-normal text-zinc-400">{count}</span></>}
      actions={<Button type="button" size="sm" variant="outline" data-always onClick={() => {
        // annotations[0] holds the defaults, so the new annotation gets index 1 or later.
        openItems.added(Math.max(1, activeFrame.annotations.length))
        patchActiveFrame(addAnnotationToFrame)
      }}>+ {t('annotation')}</Button>}
    >
      <div className="grid gap-2">
        {count === 0 ? <EmptyItems>{t('noItems')}</EmptyItems> : null}
        {activeFrame.annotations.map((annotation, annotationIndex) => {
          if (annotationIndex === 0) return null
          const text = getLocalizedLabel(annotation.text?.name ?? '', language)
          const position = positionAxes.map((axis) => annotation.axes?.[axis]).filter((value) => value !== undefined).join(', ')
          return (
            <ItemCard
              key={annotationIndex}
              icon="★"
              title={text || `${t('annotation')} ${annotationIndex}`}
              summary={[position ? `(${position})` : '', annotation.marker ? t('marker') : '', annotation.arrow ? t('arrow') : ''].filter(Boolean).join(' · ')}
              open={openItems.isOpen(annotationIndex)}
              onOpenChange={(next) => openItems.setOpen(annotationIndex, next)}
              onDuplicate={() => {
                openItems.inserted(annotationIndex + 1)
                patchActiveFrame((f) => ({ ...f, annotations: [...f.annotations.slice(0, annotationIndex + 1), structuredClone(f.annotations[annotationIndex]), ...f.annotations.slice(annotationIndex + 1)] }))
              }}
              onRemove={() => {
                openItems.removed(annotationIndex)
                patchActiveFrame((f) => ({ ...f, annotations: f.annotations.filter((_, i) => i !== annotationIndex) }))
              }}
            >
              <div className="grid gap-4 @lg:grid-cols-3">
                <LanguageFields
                  label={t('textLabel')}
                  jsonPath={`annotations[${annotationIndex}].text.name`}
                  level="check"
                  languages={activeDataframe.plotLanguages}
                  selectedLanguage={language}
                  value={(lang) => getLocalizedLabel(annotation.text?.name ?? '', lang)}
                  onChange={(lang, next) => patchText(annotationIndex, { name: setLocalizedLabel(annotation.text?.name ?? '', lang, next, activeDataframe.plotLanguages) })}
                />
                {positionAxes.length > 0 ? positionAxes.map((axisName) => (
                  <Field key={axisName} label={t('positionOn', { axis: axisName })} jsonPath={`annotations[${annotationIndex}].axes.${axisName}`} level="required" missing={annotation.axes?.[axisName] === undefined}>
                    <Input type="number" value={annotation.axes?.[axisName] ?? ''} onChange={(e) => patchPosition(annotationIndex, axisName, e.target.valueAsNumber)} />
                  </Field>
                )) : (
                  <p className="m-0 self-center text-xs text-zinc-500">{t('annotationPositionHint')}</p>
                )}
              </div>
              <div className="grid gap-4 @lg:grid-cols-3">
                <Field label={t('marker')} jsonPath={`annotations[${annotationIndex}].marker`} level="check">
                  <Toggle checked={Boolean(annotation.marker)} label={t('marker')} onChange={(on) => patchAnnotation(annotationIndex, (entry) => ({ ...entry, marker: on ? { ...DEFAULT_ANNOTATION_MARKER } : undefined }))} />
                </Field>
                <Field label={t('arrow')} jsonPath={`annotations[${annotationIndex}].arrow`} level="check">
                  <Toggle checked={Boolean(annotation.arrow)} label={t('arrow')} onChange={(on) => patchAnnotation(annotationIndex, (entry) => ({ ...entry, arrow: on ? { ...DEFAULT_ANNOTATION_ARROW } : undefined }))} />
                </Field>
              </div>
              <div className="grid gap-4 @lg:grid-cols-3">
                <Field label={t('textOffsetX')} jsonPath={`annotations[${annotationIndex}].text.rel_pos[0]`} level="default" changed={(annotation.text?.relPos?.[0] ?? 0) !== 0}>
                  <Input type="number" value={annotation.text?.relPos?.[0] ?? ''} onChange={(e) => patchText(annotationIndex, { relPos: [numberValue(e.target.valueAsNumber, annotation.text?.relPos?.[0] ?? 0), annotation.text?.relPos?.[1] ?? 0] })} />
                </Field>
                <Field label={t('textOffsetY')} jsonPath={`annotations[${annotationIndex}].text.rel_pos[1]`} level="default" changed={(annotation.text?.relPos?.[1] ?? 0) !== 0}>
                  <Input type="number" value={annotation.text?.relPos?.[1] ?? ''} onChange={(e) => patchText(annotationIndex, { relPos: [annotation.text?.relPos?.[0] ?? 0, numberValue(e.target.valueAsNumber, annotation.text?.relPos?.[1] ?? 0)] })} />
                </Field>
                <Field label={t('textColor')} jsonPath={`annotations[${annotationIndex}].text.color`} level="default" changed={(annotation.text?.color ?? DEFAULT_ANNOTATION_TEXT.color) !== DEFAULT_ANNOTATION_TEXT.color}>
                  <ColorOrMaterialInput materialColors={materialColors} value={annotation.text?.color ?? DEFAULT_ANNOTATION_TEXT.color} onChange={(color) => patchText(annotationIndex, { color })} />
                </Field>
              </div>

              {annotation.marker ? (
                <div className="grid gap-4 border-t border-dashed border-zinc-300 pt-3 @lg:grid-cols-3 dark:border-zinc-700" data-level="default">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 @lg:col-span-3">{t('markerSettings')}</div>
                  <Field label={t('markerSymbol')} jsonPath={`annotations[${annotationIndex}].marker.marker_symbol`} level="default" changed={annotation.marker.markerSymbol !== DEFAULT_ANNOTATION_MARKER.markerSymbol}>
                    <Select value={annotation.marker.markerSymbol} onChange={(e) => patchMarker(annotationIndex, { markerSymbol: e.target.value })}>
                      {MARKER_SYMBOL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}    ( {option.value} )</option>)}
                    </Select>
                  </Field>
                  <Field label={t('markerSizeFactor')} jsonPath={`annotations[${annotationIndex}].marker.size_factor`} level="default" changed={annotation.marker.sizeFactor !== DEFAULT_ANNOTATION_MARKER.sizeFactor}>
                    <Input type="number" value={annotation.marker.sizeFactor} onChange={(e) => patchMarker(annotationIndex, { sizeFactor: numberValue(e.target.valueAsNumber, annotation.marker?.sizeFactor ?? 1) })} />
                  </Field>
                  <Field label={t('markerLineWidth')} jsonPath={`annotations[${annotationIndex}].marker.linewidths`} level="default" changed={annotation.marker.linewidths !== DEFAULT_ANNOTATION_MARKER.linewidths}>
                    <Input type="number" value={annotation.marker.linewidths} onChange={(e) => patchMarker(annotationIndex, { linewidths: numberValue(e.target.valueAsNumber, annotation.marker?.linewidths ?? 0) })} />
                  </Field>
                  <Field label={t('markerColor')} jsonPath={`annotations[${annotationIndex}].marker.color`} level="default" changed={annotation.marker.color !== DEFAULT_ANNOTATION_MARKER.color}>
                    <ColorOrMaterialInput materialColors={materialColors} value={annotation.marker.color} onChange={(next) => patchMarker(annotationIndex, { color: next })} />
                  </Field>
                  <Field label={t('markerEdgeColor')} jsonPath={`annotations[${annotationIndex}].marker.edgecolors`} level="default" changed={annotation.marker.edgecolors !== DEFAULT_ANNOTATION_MARKER.edgecolors}>
                    <ColorOrMaterialInput materialColors={materialColors} value={annotation.marker.edgecolors} onChange={(next) => patchMarker(annotationIndex, { edgecolors: next })} />
                  </Field>
                </div>
              ) : null}

              {annotation.arrow ? (
                <div className="grid gap-4 border-t border-dashed border-zinc-300 pt-3 @lg:grid-cols-3 dark:border-zinc-700" data-level="default">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 @lg:col-span-3">{t('arrowSettings')}</div>
                  <Field label={t('arrowWidth')} jsonPath={`annotations[${annotationIndex}].arrow.width`} level="default" changed={annotation.arrow.width !== DEFAULT_ANNOTATION_ARROW.width}>
                    <Input type="number" value={annotation.arrow.width} onChange={(e) => patchArrow(annotationIndex, { width: numberValue(e.target.valueAsNumber, annotation.arrow?.width ?? 1) })} />
                  </Field>
                  <Field label={t('arrowHeadLength')} jsonPath={`annotations[${annotationIndex}].arrow.headlength`} level="default" changed={annotation.arrow.headlength !== DEFAULT_ANNOTATION_ARROW.headlength}>
                    <Input type="number" value={annotation.arrow.headlength} onChange={(e) => patchArrow(annotationIndex, { headlength: numberValue(e.target.valueAsNumber, annotation.arrow?.headlength ?? 10) })} />
                  </Field>
                  <Field label={t('arrowHeadWidth')} jsonPath={`annotations[${annotationIndex}].arrow.headwidth`} level="default" changed={annotation.arrow.headwidth !== DEFAULT_ANNOTATION_ARROW.headwidth}>
                    <Input type="number" value={annotation.arrow.headwidth} onChange={(e) => patchArrow(annotationIndex, { headwidth: numberValue(e.target.valueAsNumber, annotation.arrow?.headwidth ?? 6) })} />
                  </Field>
                  <Field label={t('arrowLineWidth')} jsonPath={`annotations[${annotationIndex}].arrow.linewidth`} level="default" changed={annotation.arrow.linewidth !== DEFAULT_ANNOTATION_ARROW.linewidth}>
                    <Input type="number" value={annotation.arrow.linewidth} onChange={(e) => patchArrow(annotationIndex, { linewidth: numberValue(e.target.valueAsNumber, annotation.arrow?.linewidth ?? 1) })} />
                  </Field>
                  <Field label={t('arrowFaceColor')} jsonPath={`annotations[${annotationIndex}].arrow.facecolor`} level="default" changed={annotation.arrow.facecolor !== DEFAULT_ANNOTATION_ARROW.facecolor}>
                    <ColorOrMaterialInput materialColors={materialColors} value={annotation.arrow.facecolor} onChange={(next) => patchArrow(annotationIndex, { facecolor: next })} />
                  </Field>
                </div>
              ) : null}
            </ItemCard>
          )
        })}
      </div>

      <div className="grid gap-4 @lg:grid-cols-2">
        <Field label={t('defaultMarkerSize')} jsonPath="annotations[0].marker_size" level="default" changed={defaults?.markerSize !== DEFAULT_ANNOTATION_SETTINGS.markerSize}>
          <Input type="number" min={1} value={defaults?.markerSize ?? DEFAULT_ANNOTATION_SETTINGS.markerSize} onChange={(e) => patchAnnotation(0, (entry) => ({ ...entry, markerSize: positiveValue(e.target.valueAsNumber, entry.markerSize ?? DEFAULT_ANNOTATION_SETTINGS.markerSize!) }))} />
        </Field>
        <Field label={t('defaultFontSize')} jsonPath="annotations[0].font_size" level="default" changed={defaults?.fontSize !== DEFAULT_ANNOTATION_SETTINGS.fontSize}>
          <Input type="number" min={1} value={defaults?.fontSize ?? DEFAULT_ANNOTATION_SETTINGS.fontSize} onChange={(e) => patchAnnotation(0, (entry) => ({ ...entry, fontSize: positiveValue(e.target.valueAsNumber, entry.fontSize ?? DEFAULT_ANNOTATION_SETTINGS.fontSize!) }))} />
        </Field>
      </div>
    </SettingsGroup>
  )
}
