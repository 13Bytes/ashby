import type { FrameConfig } from '../config/defaultPlotConfig'
import type { ColorOrMaterialInputComponent, FieldComponent, RemoveIconButtonComponent } from '../types/componentProps'
import type { UILanguage } from '../uiTranslations'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'

const MARKER_SYMBOL_OPTIONS = [
  { value: 'o', label: 'circle (o)' },
  { value: 's', label: 'square (s)' },
  { value: '^', label: 'triangle up (^)' },
  { value: 'v', label: 'triangle down (v)' },
  { value: 'D', label: 'diamond (D)' },
  { value: 'x', label: 'x (x)' },
  { value: '*', label: 'star (*)' },
]

type Props = {
  t: (key: string) => string
  uiLanguage: UILanguage
  activeFrame: FrameConfig
  hoveredRemoveGroup: string | null
  setHoveredRemoveGroup: (value: string | null) => void
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  numberValue: (value: number, fallback: number) => number
  materialColorOptions: string[]
  FieldComponent: FieldComponent
  RemoveIconButtonComponent: RemoveIconButtonComponent
  ColorOrMaterialInputComponent: ColorOrMaterialInputComponent
}

export function AnnotationsSection({ t, uiLanguage, activeFrame, hoveredRemoveGroup, setHoveredRemoveGroup, patchActiveFrame, numberValue, materialColorOptions, FieldComponent: Field, RemoveIconButtonComponent: RemoveIconButton, ColorOrMaterialInputComponent: ColorOrMaterialInput }: Props) {
  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-center gap-2">
          <h3 className="m-0 text-sm font-semibold">{t('annotations')}</h3>
          <Button type="button" size="sm" variant="outline" onClick={() => patchActiveFrame((f) => ({ ...f, annotations: [...f.annotations, { text: { name: '', relPos: [0, 0], color: '#111827' }, axes: {}, marker: undefined, arrow: undefined }] }))}>+ Annotation</Button>
        </div>

        <Field language={uiLanguage} label="Default marker size" jsonPath="annotations[0].marker_size"><Input type="number" value={activeFrame.annotations[0]?.markerSize ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === 0 ? { ...entry, markerSize: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : entry) }))} /></Field>
        <Field language={uiLanguage} label="Default font size" jsonPath="annotations[0].font_size"><Input type="number" value={activeFrame.annotations[0]?.fontSize ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === 0 ? { ...entry, fontSize: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : entry) }))} /></Field>
        {activeFrame.annotations.map((annotation, annotationIndex) => (
          <div key={annotationIndex} className={`relative grid gap-2 rounded-lg border p-3 pr-12 sm:col-span-2 sm:grid-cols-4  ${hoveredRemoveGroup === `annotation-${annotationIndex}` ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}>
            <RemoveIconButton onHoverChange={(hovered: boolean) => setHoveredRemoveGroup(hovered ? `annotation-${annotationIndex}` : null)} onClick={() => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.filter((_, i) => i !== annotationIndex) }))} />
            <Field language={uiLanguage} label="Text label" jsonPath={`annotations[${annotationIndex}].text.name`} className='sm:col-span-2'>
              <Input value={annotation.text?.name ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, text: { name: e.target.value, relPos: entry.text?.relPos ?? [0, 0], color: entry.text?.color ?? '#111827', fontSize: entry.text?.fontSize } } : entry) }))} /></Field>
            <Field language={uiLanguage} label="Text offset X" jsonPath={`annotations[${annotationIndex}].text.rel_pos[0]`}>
              <Input type="number" value={annotation.text?.relPos?.[0] ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, text: { name: entry.text?.name ?? '', relPos: [numberValue(e.target.valueAsNumber, entry.text?.relPos?.[0] ?? 0), entry.text?.relPos?.[1] ?? 0], color: entry.text?.color ?? '#111827', fontSize: entry.text?.fontSize } } : entry) }))} /></Field>
            <Field language={uiLanguage} label="Text offset Y" jsonPath={`annotations[${annotationIndex}].text.rel_pos[1]`}>
              <Input type="number" value={annotation.text?.relPos?.[1] ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, text: { name: entry.text?.name ?? '', relPos: [entry.text?.relPos?.[0] ?? 0, numberValue(e.target.valueAsNumber, entry.text?.relPos?.[1] ?? 0)], color: entry.text?.color ?? '#111827', fontSize: entry.text?.fontSize } } : entry) }))} /></Field>
            <Field language={uiLanguage} label="Text color" jsonPath={`annotations[${annotationIndex}].text.color`}>
              <ColorOrMaterialInput materialOptions={materialColorOptions} value={annotation.text?.color ?? '#111827'} onChange={(next: string) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, text: { name: entry.text?.name ?? '', relPos: entry.text?.relPos ?? [0, 0], color: next, fontSize: entry.text?.fontSize } } : entry) }))} />
            </Field>


            <div className="sm:col-span-4 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Extras</span>
              <Button
                type="button"
                size="sm"
                variant={annotation.marker ? 'default' : 'outline'}
                onClick={() =>
                  patchActiveFrame((f) => ({
                    ...f,
                    annotations: f.annotations.map((entry, i) =>
                      i === annotationIndex
                        ? { ...entry, marker: entry.marker ? undefined : { color: 'default', markerSymbol: 'o', sizeFactor: 1, linewidths: 0, edgecolors: 'black' }, } : entry,),
                  }))}
              >
                Marker
              </Button>
              <Button
                type="button"
                size="sm"
                variant={annotation.arrow ? 'default' : 'outline'}
                onClick={() =>
                  patchActiveFrame((f) => ({
                    ...f,
                    annotations: f.annotations.map((entry, i) =>
                      i === annotationIndex
                        ? { ...entry, arrow: entry.arrow ? undefined : { width: 1, facecolor: 'blue', headlength: 10, headwidth: 6, linewidth: 1 }, } : entry,),
                  }))}
              >
                Arrow
              </Button>
            </div>


            {annotation.marker ?
              <div className='sm:col-span-4 grid gap-2 sm:grid-cols-5'>
                <div className="sm:col-span-5 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Marker settings</div>
                <Field language={uiLanguage} label="Marker symbol" jsonPath={`annotations[${annotationIndex}].marker.marker_symbol`}>
                  <div className="grid gap-2">
                    <Select
                      value={MARKER_SYMBOL_OPTIONS.some((option) => option.value === annotation.marker!.markerSymbol) ? annotation.marker!.markerSymbol : 'custom'}
                      onChange={(e) => {
                        const nextSelection = e.target.value
                        if (nextSelection !== 'custom') {
                          patchActiveFrame((f) => ({
                            ...f,
                            annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, marker: { ...(entry.marker ?? { color: 'default', markerSymbol: 'o', sizeFactor: 1, linewidths: 0, edgecolors: 'black' }), markerSymbol: nextSelection } } : entry),
                          }))
                        }
                      }}
                    >
                      {MARKER_SYMBOL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                      <option disabled>──────────</option>
                      <option value="custom">custom…</option>
                    </Select>
                      {!MARKER_SYMBOL_OPTIONS.some((option) => option.value === annotation.marker!.markerSymbol) ? (
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <Input
                            value={annotation.marker!.markerSymbol ?? ''}
                            onChange={(e) => {
                              const nextCustomValue = e.target.value
                              patchActiveFrame((f) => ({
                                ...f,
                                annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, marker: { ...(entry.marker ?? { color: 'default', markerSymbol: 'o', sizeFactor: 1, linewidths: 0, edgecolors: 'black' }), markerSymbol: nextCustomValue } } : entry),
                              }))
                            }}
                            placeholder="custom marker symbol"
                        />
                        <a href="https://matplotlib.org/stable/api/markers_api.html" target="_blank" rel="noreferrer">
                          <Button type="button" size="sm" variant="outline">Help</Button>
                        </a>
                      </div>
                    ) : null}
                  </div>
                </Field>
                {/* & save values if deiabled */}
                <Field language={uiLanguage} label="Marker size factor" jsonPath={`annotations[${annotationIndex}].marker.size_factor`}>
                  <Input type="number" value={annotation.marker!.sizeFactor} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, marker: { ...(entry.marker ?? { color: 'default', markerSymbol: 'o', sizeFactor: 1, linewidths: 0, edgecolors: 'black' }), sizeFactor: numberValue(e.target.valueAsNumber, annotation.marker?.sizeFactor ?? 1) } } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Marker linewidth"   jsonPath={`annotations[${annotationIndex}].marker.linewidths` }>
                  <Input type="number" value={annotation.marker!.linewidths} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, marker: { ...(entry.marker ?? { color: 'default', markerSymbol: 'o', sizeFactor: 1, linewidths: 0, edgecolors: 'black' }), linewidths: numberValue(e.target.valueAsNumber, annotation.marker?.linewidths ?? 0) } } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Marker color" jsonPath={`annotations[${annotationIndex}].marker.color`}>
                  <ColorOrMaterialInput materialOptions={materialColorOptions} value={annotation.marker!.color} onChange={(next: string) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, marker: { ...(entry.marker ?? { color: 'default', markerSymbol: 'o', sizeFactor: 1, linewidths: 0, edgecolors: 'black' }), color: next } } : entry) }))} />
                </Field>
                <Field language={uiLanguage} label="Marker edgecolors" jsonPath={`annotations[${annotationIndex}].marker.edgecolors`}>
                  <ColorOrMaterialInput materialOptions={materialColorOptions} value={annotation.marker!.edgecolors} onChange={(next: string) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, marker: { ...(entry.marker ?? { color: 'default', markerSymbol: 'o', sizeFactor: 1, linewidths: 0, edgecolors: 'black' }), color: next } } : entry) }))} />
                </Field>
              </div> : null}

            {annotation.arrow ?
              <div className='sm:col-span-4 grid gap-2 sm:grid-cols-5'>
                <div className="sm:col-span-5 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Arrow settings</div>
                <Field language={uiLanguage} label="Arrow width" jsonPath={`annotations[${annotationIndex}].arrow.width`}>
                  <Input type="number" value={annotation.arrow.width} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, arrow: { ...(entry.arrow ?? { width: 1, facecolor: 'blue', headlength: 10, headwidth: 6, linewidth: 1 }), width: numberValue(e.target.valueAsNumber, annotation.arrow?.width ?? 1) } } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Arrow headlength" jsonPath={`annotations[${annotationIndex}].arrow.headlength`}>
                  <Input type="number" value={annotation.arrow.headlength} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, arrow: { ...(entry.arrow ?? { width: 1, facecolor: 'blue', headlength: 10, headwidth: 6, linewidth: 1 }), headlength: numberValue(e.target.valueAsNumber, annotation.arrow?.headlength ?? 10) } } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Arrow headwidth" jsonPath={`annotations[${annotationIndex}].arrow.headwidth`}>
                  <Input type="number" value={annotation.arrow.headwidth} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, arrow: { ...(entry.arrow ?? { width: 1, facecolor: 'blue', headlength: 10, headwidth: 6, linewidth: 1 }), headwidth: numberValue(e.target.valueAsNumber, annotation.arrow?.headwidth ?? 6) } } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Arrow linewidth" jsonPath={`annotations[${annotationIndex}].arrow.linewidth`}>
                  <Input type="number" value={annotation.arrow.linewidth} onChange={(e) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, arrow: { ...(entry.arrow ?? { width: 1, facecolor: 'blue', headlength: 10, headwidth: 6, linewidth: 1 }), linewidth: numberValue(e.target.valueAsNumber, annotation.arrow?.linewidth ?? 1) } } : entry) }))} /></Field>
                <Field language={uiLanguage} label="Arrow facecolor" jsonPath={`annotations[${annotationIndex}].arrow.facecolor`}>
                  <ColorOrMaterialInput materialOptions={materialColorOptions} value={annotation.arrow.facecolor} onChange={(next: string) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry, i) => i === annotationIndex ? { ...entry, arrow: { ...(entry.arrow ?? { width: 1, facecolor: 'blue', headlength: 10, headwidth: 6, linewidth: 1 }), facecolor: next } } : entry) }))} />
                </Field>
              </div> : null}
          </div>
        ))}
      </section>
  )
}
