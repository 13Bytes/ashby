import { Button } from './ui/button'
import { Input } from './ui/input'
import type { FrameConfig } from '../config/defaultPlotConfig'
import type { UILanguage } from '../uiTranslations'
import type { ColorOrMaterialInputComponent, FieldComponent, RemoveIconButtonComponent } from '../types/componentProps'
import { addColoredAreaToFrame, parseNumberList, toCommaList } from '../utils/coloredAreas'

type Props = {
  t: (key: string) => string
  uiLanguage: UILanguage
  activeFrame: FrameConfig
  hoveredRemoveGroup: string | null
  setHoveredRemoveGroup: (value: string | null) => void
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  parseJsonField: <T>(raw: string, fallback: T) => T
  numberValue: (value: number, fallback: number) => number
  materialColorOptions: string[]
  FieldComponent: FieldComponent
  RemoveIconButtonComponent: RemoveIconButtonComponent
  ColorOrMaterialInputComponent: ColorOrMaterialInputComponent
}

export function ColoredAreasSection({ t, uiLanguage, activeFrame, hoveredRemoveGroup, setHoveredRemoveGroup, patchActiveFrame, parseJsonField, numberValue, materialColorOptions, FieldComponent: Field, RemoveIconButtonComponent: RemoveIconButton, ColorOrMaterialInputComponent: ColorOrMaterialInput }: Props) {
  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
      <div className="sm:col-span-2 flex items-center gap-2">
        <h3 className="m-0 text-sm font-semibold">{t('coloredAreas')}</h3>
        <Button type="button" size="sm" variant="outline" onClick={() => patchActiveFrame((f) => addColoredAreaToFrame(f))}>+ Area</Button>

      </div>{activeFrame.coloredAreas.map((area, areaIndex) => (
        <div key={areaIndex} className={`relative grid gap-2 rounded-lg border p-3 pr-12 sm:col-span-2 sm:grid-cols-2 ${hoveredRemoveGroup === `area-${areaIndex}` ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}>
          <RemoveIconButton onHoverChange={(hovered: boolean) => setHoveredRemoveGroup(hovered ? `area-${areaIndex}` : null)} onClick={() => patchActiveFrame((f) => (
            { ...f, coloredAreas: f.coloredAreas.filter((_, i) => i !== areaIndex) }))} />
          <Field language={uiLanguage} label="Axis ranges JSON" jsonPath={`colored_areas[${areaIndex}].axes`}>
            <Input value={JSON.stringify(area.axes ?? {})} onChange={(e) => patchActiveFrame((f) => (
              { ...f, coloredAreas: f.coloredAreas.map((entry, i) => i === areaIndex ? { ...entry, axes: parseJsonField<Record<string, [number, number][]>>(e.target.value, entry.axes ?? {}) } : entry) }))} />
          </Field>
          <Field language={uiLanguage} label="Polygon X points (comma separated)" jsonPath={`colored_areas[${areaIndex}].x`}>
            <Input value={toCommaList(area.x)} onChange={(e) => patchActiveFrame((f) => ({ ...f, coloredAreas: f.coloredAreas.map((entry, i) => i === areaIndex ? { ...entry, x: parseNumberList(e.target.value) } : entry) }))} />
          </Field>
          <Field language={uiLanguage} label="Polygon Y points (comma separated)" jsonPath={`colored_areas[${areaIndex}].y`}>
            <Input value={toCommaList(area.y)} onChange={(e) => patchActiveFrame((f) => ({ ...f, coloredAreas: f.coloredAreas.map((entry, i) => i === areaIndex ? { ...entry, y: parseNumberList(e.target.value) } : entry) }))} />
          </Field>
          <Field language={uiLanguage} label="color" jsonPath={`colored_areas[${areaIndex}].color`}>
            <ColorOrMaterialInput materialOptions={materialColorOptions} value={area.color} onChange={(next: string) => patchActiveFrame((f) => (
              { ...f, coloredAreas: f.coloredAreas.map((entry, i) => i === areaIndex ? { ...entry, color: next } : entry) }))} />
          </Field>
          <Field language={uiLanguage} label={t('alpha')} jsonPath={`colored_areas[${areaIndex}].alpha`}>
            <Input type="number" min={0} max={1} step={0.05} value={area.alpha} onChange={(e) => patchActiveFrame((f) => (
              { ...f, coloredAreas: f.coloredAreas.map((entry, i) => i === areaIndex ? { ...entry, alpha: numberValue(e.target.valueAsNumber, entry.alpha) } : entry) }))} />
          </Field>
        </div>
      ))}
      
    </section>
  )
}
