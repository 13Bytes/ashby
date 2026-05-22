import { Button } from './ui/button'
import { Input } from './ui/input'

type Props = {
  t: (key: string) => string
  uiLanguage: any
  activeFrame: any
  hoveredRemoveGroup: string | null
  setHoveredRemoveGroup: (value: string | null) => void
  patchActiveFrame: (updater: (frame: any) => any) => void
  numberValue: (value: number, fallback: number) => number
  materialColorOptions: string[]
  FieldComponent: any
  RemoveIconButtonComponent: any
  ColorOrMaterialInputComponent: any
}

export function AnnotationsSection({ t, uiLanguage, activeFrame, hoveredRemoveGroup, setHoveredRemoveGroup, patchActiveFrame, numberValue, materialColorOptions, FieldComponent: Field, RemoveIconButtonComponent: RemoveIconButton, ColorOrMaterialInputComponent: ColorOrMaterialInput }: Props) {
  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
      <div className="sm:col-span-2 flex items-center gap-2">
        <h3 className="m-0 text-sm font-semibold">{t('annotations')}</h3>
        <Button type="button" size="sm" variant="outline" onClick={() => patchActiveFrame((f) => ({ ...f, annotations: [...f.annotations, { text: { name: '', relPos: [0, 0], color: '#111827' }, axes: {}, marker: undefined, arrow: undefined }] }))}>+ Annotation</Button>
      </div>
      <Field language={uiLanguage} label="Default marker size" jsonPath="annotations[0].marker_size"><Input type="number" value={activeFrame.annotations[0]?.markerSize ?? ''} onChange={(e:any) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry:any, i:number) => i === 0 ? { ...entry, markerSize: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : entry) }))} /></Field>
      <Field language={uiLanguage} label="Default font size" jsonPath="annotations[0].font_size"><Input type="number" value={activeFrame.annotations[0]?.fontSize ?? ''} onChange={(e:any) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry:any, i:number) => i === 0 ? { ...entry, fontSize: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : entry) }))} /></Field>
      {activeFrame.annotations.map((annotation:any, annotationIndex:number) => (
        <div key={annotationIndex} className={`relative grid gap-2 rounded-lg border p-3 pr-12 sm:col-span-2 sm:grid-cols-4  ${hoveredRemoveGroup === `annotation-${annotationIndex}` ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}>
          <RemoveIconButton onHoverChange={(hovered:boolean) => setHoveredRemoveGroup(hovered ? `annotation-${annotationIndex}` : null)} onClick={() => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.filter((_:any, i:number) => i !== annotationIndex) }))} />
          <Field language={uiLanguage} label="Text label" jsonPath={`annotations[${annotationIndex}].text.name`} className='sm:col-span-2'><Input value={annotation.text?.name ?? ''} onChange={(e:any) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry:any, i:number) => i === annotationIndex ? { ...entry, text: { name: e.target.value, relPos: entry.text?.relPos ?? [0, 0], color: entry.text?.color ?? '#111827', fontSize: entry.text?.fontSize } } : entry) }))} /></Field>
          <Field language={uiLanguage} label="Text offset X" jsonPath={`annotations[${annotationIndex}].text.rel_pos[0]`}><Input type="number" value={annotation.text?.relPos?.[0] ?? ''} onChange={(e:any) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry:any, i:number) => i === annotationIndex ? { ...entry, text: { name: entry.text?.name ?? '', relPos: [numberValue(e.target.valueAsNumber, entry.text?.relPos?.[0] ?? 0), entry.text?.relPos?.[1] ?? 0], color: entry.text?.color ?? '#111827', fontSize: entry.text?.fontSize } } : entry) }))} /></Field>
          <Field language={uiLanguage} label="Text offset Y" jsonPath={`annotations[${annotationIndex}].text.rel_pos[1]`}><Input type="number" value={annotation.text?.relPos?.[1] ?? ''} onChange={(e:any) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry:any, i:number) => i === annotationIndex ? { ...entry, text: { name: entry.text?.name ?? '', relPos: [entry.text?.relPos?.[0] ?? 0, numberValue(e.target.valueAsNumber, entry.text?.relPos?.[1] ?? 0)], color: entry.text?.color ?? '#111827', fontSize: entry.text?.fontSize } } : entry) }))} /></Field>
          <Field language={uiLanguage} label="Text color" jsonPath={`annotations[${annotationIndex}].text.color`}><ColorOrMaterialInput materialOptions={materialColorOptions} value={annotation.text?.color ?? '#111827'} onChange={(next:string) => patchActiveFrame((f) => ({ ...f, annotations: f.annotations.map((entry:any, i:number) => i === annotationIndex ? { ...entry, text: { name: entry.text?.name ?? '', relPos: entry.text?.relPos ?? [0, 0], color: next, fontSize: entry.text?.fontSize } } : entry) }))} /></Field>
        </div>
      ))}
    </section>
  )
}
