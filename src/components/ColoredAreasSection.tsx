import { Button } from './ui/button'
import { Input } from './ui/input'
import type { FrameConfig } from '../config/defaultPlotConfig'
import { useI18n } from '../uiTranslations'
import { numberValue } from '../utils/appState'
import { addColoredAreaToFrame, parseStrictNumberList, toCommaList } from '../utils/coloredAreas'
import { parseJsonField } from '../utils/configIo'
import { ColorOrMaterialInput, DraftInput, DuplicateIconButton, Field, RemoveIconButton } from './AppControls'

type Props = {
  activeFrame: FrameConfig
  hoveredRemoveGroup: string | null
  setHoveredRemoveGroup: (value: string | null) => void
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  materialColorOptions: string[]
}

type ColoredArea = FrameConfig['coloredAreas'][number]

export function ColoredAreasSection({ activeFrame, hoveredRemoveGroup, setHoveredRemoveGroup, patchActiveFrame, materialColorOptions }: Props) {
  const { t } = useI18n()
  const patchArea = (areaIndex: number, patch: (area: ColoredArea) => ColoredArea) =>
    patchActiveFrame((f) => ({ ...f, coloredAreas: f.coloredAreas.map((entry, i) => (i === areaIndex ? patch(entry) : entry)) }))

  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
      <div className="sm:col-span-2 flex items-center gap-2">
        <h3 className="m-0 text-m font-semibold text-violet-500">{t('coloredAreas')}</h3>
        <Button type="button" size="sm" variant="outline" onClick={() => patchActiveFrame((f) => addColoredAreaToFrame(f))}>+ {t('area')}</Button>
      </div>
      {activeFrame.coloredAreas.map((area, areaIndex) => (
        <div key={areaIndex} className={`relative grid gap-2 rounded-lg border p-2 pr-15 sm:col-span-2 sm:grid-cols-2 ${hoveredRemoveGroup === `area-${areaIndex}` ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}>
          <DuplicateIconButton onClick={() => patchActiveFrame((f) => (
            { ...f, coloredAreas: [...f.coloredAreas.slice(0, areaIndex + 1), structuredClone(f.coloredAreas[areaIndex]), ...f.coloredAreas.slice(areaIndex + 1)] }))} />
          <RemoveIconButton onHoverChange={(hovered) => setHoveredRemoveGroup(hovered ? `area-${areaIndex}` : null)} onClick={() => patchActiveFrame((f) => (
            { ...f, coloredAreas: f.coloredAreas.filter((_, i) => i !== areaIndex) }))} />
          <Field label={t('axisRangesJson')} jsonPath={`colored_areas[${areaIndex}].axes`}>
            <DraftInput
              value={JSON.stringify(area.axes ?? {})}
              parse={(text) => parseJsonField<NonNullable<ColoredArea['axes']>>(text, {})}
              onCommit={(axes) => patchArea(areaIndex, (entry) => ({ ...entry, axes }))}
            />
          </Field>
          <Field label={t('polygonX')} jsonPath={`colored_areas[${areaIndex}].x`}>
            <DraftInput value={toCommaList(area.x)} parse={parseStrictNumberList} onCommit={(x) => patchArea(areaIndex, (entry) => ({ ...entry, x }))} />
          </Field>
          <Field label={t('polygonY')} jsonPath={`colored_areas[${areaIndex}].y`}>
            <DraftInput value={toCommaList(area.y)} parse={parseStrictNumberList} onCommit={(y) => patchArea(areaIndex, (entry) => ({ ...entry, y }))} />
          </Field>
          <Field label={t('color')} jsonPath={`colored_areas[${areaIndex}].color`}>
            <ColorOrMaterialInput materialOptions={materialColorOptions} value={area.color} onChange={(color) => patchArea(areaIndex, (entry) => ({ ...entry, color }))} />
          </Field>
          <Field label={t('alpha')} jsonPath={`colored_areas[${areaIndex}].alpha`}>
            <Input type="number" min={0} max={1} step={0.05} value={area.alpha} onChange={(e) => patchArea(areaIndex, (entry) => ({ ...entry, alpha: numberValue(e.target.valueAsNumber, entry.alpha) }))} />
          </Field>
        </div>
      ))}
    </section>
  )
}
