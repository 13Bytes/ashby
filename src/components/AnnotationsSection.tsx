import type { AnnotationConfig, FrameConfig } from '../config/defaultPlotConfig'
import type { UILanguage } from '../uiTranslations'
import { numberValue } from '../utils/appState'
import { addAnnotationToFrame, DEFAULT_ANNOTATION_SETTINGS } from '../utils/configEditing'
import { ColorOrMaterialInput, DuplicateIconButton, Field, RemoveIconButton } from './AppControls'
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

const DEFAULT_TEXT: AnnotationText = { name: '', relPos: [0, 0], color: '#111827' }
const DEFAULT_MARKER: AnnotationMarker = { color: 'default', markerSymbol: 'o', sizeFactor: 1, linewidths: 0, edgecolors: 'black' }
const DEFAULT_ARROW: AnnotationArrow = { width: 1, facecolor: 'blue', headlength: 10, headwidth: 6, linewidth: 1 }

type Props = {
  t: (key: string) => string
  uiLanguage: UILanguage
  activeFrame: FrameConfig
  hoveredRemoveGroup: string | null
  setHoveredRemoveGroup: (value: string | null) => void
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  materialColorOptions: string[]
}

export function AnnotationsSection({ t, uiLanguage, activeFrame, hoveredRemoveGroup, setHoveredRemoveGroup, patchActiveFrame, materialColorOptions }: Props) {
  const patchAnnotation = (annotationIndex: number, patch: (annotation: AnnotationConfig) => AnnotationConfig) =>
    patchActiveFrame((f) => {
      // annotations[0] holds the defaults; create it if an older config has no annotations at all.
      const annotations = f.annotations.length > 0 ? f.annotations : [{ ...DEFAULT_ANNOTATION_SETTINGS }]
      return { ...f, annotations: annotations.map((entry, i) => (i === annotationIndex ? patch(entry) : entry)) }
    })
  const patchText = (annotationIndex: number, patch: Partial<AnnotationText>) =>
    patchAnnotation(annotationIndex, (entry) => ({ ...entry, text: { ...(entry.text ?? DEFAULT_TEXT), ...patch } }))
  const patchMarker = (annotationIndex: number, patch: Partial<AnnotationMarker>) =>
    patchAnnotation(annotationIndex, (entry) => ({ ...entry, marker: { ...(entry.marker ?? DEFAULT_MARKER), ...patch } }))
  const patchArrow = (annotationIndex: number, patch: Partial<AnnotationArrow>) =>
    patchAnnotation(annotationIndex, (entry) => ({ ...entry, arrow: { ...(entry.arrow ?? DEFAULT_ARROW), ...patch } }))
  const patchPosition = (annotationIndex: number, axisName: string, value: number) =>
    patchAnnotation(annotationIndex, (entry) => {
      const axes = { ...(entry.axes ?? {}) }
      if (Number.isFinite(value)) axes[axisName] = value
      else delete axes[axisName]
      return { ...entry, axes }
    })

  const defaults = activeFrame.annotations[0]
  const positionAxes = [activeFrame.xQuantity, activeFrame.yQuantity].filter((axis, index, all): axis is string => Boolean(axis) && all.indexOf(axis) === index)

  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
      <div className="sm:col-span-2 flex items-center gap-2">
        <h3 className="m-0 text-m font-semibold text-violet-500">{t('annotations')}</h3>
        <Button type="button" size="sm" variant="outline" onClick={() => patchActiveFrame(addAnnotationToFrame)}>+ Annotation</Button>
      </div>

      <Field language={uiLanguage} label="Default marker size" jsonPath="annotations[0].marker_size">
        <Input type="number" value={defaults?.markerSize ?? ''} onChange={(e) => patchAnnotation(0, (entry) => ({ ...entry, markerSize: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} />
      </Field>
      <Field language={uiLanguage} label="Default font size" jsonPath="annotations[0].font_size">
        <Input type="number" value={defaults?.fontSize ?? ''} onChange={(e) => patchAnnotation(0, (entry) => ({ ...entry, fontSize: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} />
      </Field>

      {activeFrame.annotations.map((annotation, annotationIndex) => annotationIndex === 0 ? null : (
        <div key={annotationIndex} className={`relative grid gap-2 rounded-lg border p-2 pr-15 sm:col-span-2 sm:grid-cols-4  ${hoveredRemoveGroup === `annotation-${annotationIndex}` ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}>
          <DuplicateIconButton onClick={() => patchActiveFrame((f) => ({ ...f, annotations: [...f.annotations.slice(0, annotationIndex + 1), structuredClone(f.annotations[annotationIndex]), ...f.annotations.slice(annotationIndex + 1)] }))} />
          <RemoveIconButton onHoverChange={(hovered) => setHoveredRemoveGroup(hovered ? `annotation-${annotationIndex}` : null)} onClick={() => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.filter((_, i) => i !== annotationIndex) }))} />
          <Field language={uiLanguage} label="Text label" jsonPath={`annotations[${annotationIndex}].text.name`}>
            <Input value={annotation.text?.name ?? ''} onChange={(e) => patchText(annotationIndex, { name: e.target.value })} />
          </Field>
          <Field language={uiLanguage} label="Text offset X" jsonPath={`annotations[${annotationIndex}].text.rel_pos[0]`}>
            <Input type="number" value={annotation.text?.relPos?.[0] ?? ''} onChange={(e) => patchText(annotationIndex, { relPos: [numberValue(e.target.valueAsNumber, annotation.text?.relPos?.[0] ?? 0), annotation.text?.relPos?.[1] ?? 0] })} />
          </Field>
          <Field language={uiLanguage} label="Text offset Y" jsonPath={`annotations[${annotationIndex}].text.rel_pos[1]`}>
            <Input type="number" value={annotation.text?.relPos?.[1] ?? ''} onChange={(e) => patchText(annotationIndex, { relPos: [annotation.text?.relPos?.[0] ?? 0, numberValue(e.target.valueAsNumber, annotation.text?.relPos?.[1] ?? 0)] })} />
          </Field>
          <Field language={uiLanguage} label="Text color" jsonPath={`annotations[${annotationIndex}].text.color`}>
            <ColorOrMaterialInput materialOptions={materialColorOptions} value={annotation.text?.color ?? DEFAULT_TEXT.color} onChange={(color) => patchText(annotationIndex, { color })} />
          </Field>
          {positionAxes.length > 0 ? positionAxes.map((axisName) => (
            <Field key={axisName} language={uiLanguage} label={`Position on ${axisName}`} jsonPath={`annotations[${annotationIndex}].axes.${axisName}`}>
              <Input type="number" value={annotation.axes?.[axisName] ?? ''} onChange={(e) => patchPosition(annotationIndex, axisName, e.target.valueAsNumber)} />
            </Field>
          )) : (
            <p className="m-0 self-center text-xs text-zinc-500">Select the frame's x and y quantity to position this annotation.</p>
          )}

          <div className="sm:col-span-4 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Extras</span>
            <Button type="button" size="sm" variant={annotation.marker ? 'default' : 'outline'} onClick={() => patchAnnotation(annotationIndex, (entry) => ({ ...entry, marker: entry.marker ? undefined : { ...DEFAULT_MARKER } }))}>
              Marker
            </Button>
            <Button type="button" size="sm" variant={annotation.arrow ? 'default' : 'outline'} onClick={() => patchAnnotation(annotationIndex, (entry) => ({ ...entry, arrow: entry.arrow ? undefined : { ...DEFAULT_ARROW } }))}>
              Arrow
            </Button>
          </div>

          {/* & save values if disabled */}
          {annotation.marker ? (
            <div className="sm:col-span-4 grid gap-2 sm:grid-cols-5">
              <div className="sm:col-span-5 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Marker settings</div>
              <Field language={uiLanguage} label="Marker symbol" jsonPath={`annotations[${annotationIndex}].marker.marker_symbol`}>
                <Select value={annotation.marker.markerSymbol} onChange={(e) => patchMarker(annotationIndex, { markerSymbol: e.target.value })}>
                  {MARKER_SYMBOL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}    ( {option.value} )</option>
                  ))}
                </Select>
              </Field>
              <Field language={uiLanguage} label="Marker size factor" jsonPath={`annotations[${annotationIndex}].marker.size_factor`}>
                <Input type="number" value={annotation.marker.sizeFactor} onChange={(e) => patchMarker(annotationIndex, { sizeFactor: numberValue(e.target.valueAsNumber, annotation.marker?.sizeFactor ?? 1) })} />
              </Field>
              <Field language={uiLanguage} label="Marker linewidth" jsonPath={`annotations[${annotationIndex}].marker.linewidths`}>
                <Input type="number" value={annotation.marker.linewidths} onChange={(e) => patchMarker(annotationIndex, { linewidths: numberValue(e.target.valueAsNumber, annotation.marker?.linewidths ?? 0) })} />
              </Field>
              <Field language={uiLanguage} label="Marker color" jsonPath={`annotations[${annotationIndex}].marker.color`}>
                <ColorOrMaterialInput materialOptions={materialColorOptions} value={annotation.marker.color} onChange={(next) => patchMarker(annotationIndex, { color: next })} />
              </Field>
              <Field language={uiLanguage} label="Marker edgecolors" jsonPath={`annotations[${annotationIndex}].marker.edgecolors`}>
                <ColorOrMaterialInput materialOptions={materialColorOptions} value={annotation.marker.edgecolors} onChange={(next) => patchMarker(annotationIndex, { edgecolors: next })} />
              </Field>
            </div>
          ) : null}

          {annotation.arrow ? (
            <div className="sm:col-span-4 grid gap-2 sm:grid-cols-5">
              <div className="sm:col-span-5 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Arrow settings</div>
              <Field language={uiLanguage} label="Arrow width" jsonPath={`annotations[${annotationIndex}].arrow.width`}>
                <Input type="number" value={annotation.arrow.width} onChange={(e) => patchArrow(annotationIndex, { width: numberValue(e.target.valueAsNumber, annotation.arrow?.width ?? 1) })} />
              </Field>
              <Field language={uiLanguage} label="Arrow headlength" jsonPath={`annotations[${annotationIndex}].arrow.headlength`}>
                <Input type="number" value={annotation.arrow.headlength} onChange={(e) => patchArrow(annotationIndex, { headlength: numberValue(e.target.valueAsNumber, annotation.arrow?.headlength ?? 10) })} />
              </Field>
              <Field language={uiLanguage} label="Arrow headwidth" jsonPath={`annotations[${annotationIndex}].arrow.headwidth`}>
                <Input type="number" value={annotation.arrow.headwidth} onChange={(e) => patchArrow(annotationIndex, { headwidth: numberValue(e.target.valueAsNumber, annotation.arrow?.headwidth ?? 6) })} />
              </Field>
              <Field language={uiLanguage} label="Arrow linewidth" jsonPath={`annotations[${annotationIndex}].arrow.linewidth`}>
                <Input type="number" value={annotation.arrow.linewidth} onChange={(e) => patchArrow(annotationIndex, { linewidth: numberValue(e.target.valueAsNumber, annotation.arrow?.linewidth ?? 1) })} />
              </Field>
              <Field language={uiLanguage} label="Arrow facecolor" jsonPath={`annotations[${annotationIndex}].arrow.facecolor`}>
                <ColorOrMaterialInput materialOptions={materialColorOptions} value={annotation.arrow.facecolor} onChange={(next) => patchArrow(annotationIndex, { facecolor: next })} />
              </Field>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  )
}
