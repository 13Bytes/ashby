import { Button } from './ui/button'
import { Input } from './ui/input'
import type { FrameConfig } from '../config/defaultPlotConfig'
import { useI18n } from '../uiTranslations'
import { numberValue } from '../utils/appState'
import { addColoredAreaToFrame } from '../utils/coloredAreas'
import { ColorOrMaterialInput, DuplicateIconButton, Field, RemoveIconButton, SectionHeading } from './AppControls'

type Props = {
  activeFrame: FrameConfig
  hoveredRemoveGroup: string | null
  setHoveredRemoveGroup: (value: string | null) => void
  hoveredDuplicateGroup: string | null
  setHoveredDuplicateGroup: (value: string | null) => void
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  materialColors: Record<string, string>
}

type ColoredArea = FrameConfig['coloredAreas'][number]
type AreaRange = NonNullable<ColoredArea['axes']>[string]

const toBound = (value: number): number | null => (Number.isFinite(value) ? value : null)

const segmentClassName = (active: boolean) =>
  `rounded-md px-3 py-1 text-sm transition-colors ${active ? 'bg-violet-600 text-white' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'}`

export function ColoredAreasSection({ activeFrame, hoveredRemoveGroup, setHoveredRemoveGroup, hoveredDuplicateGroup, setHoveredDuplicateGroup, patchActiveFrame, materialColors }: Props) {
  const { t } = useI18n()
  // The backend only reads the ranges of the frame's x and y quantity.
  const rangeAxes = [activeFrame.xQuantity, activeFrame.yQuantity].filter((axis, index, all): axis is string => Boolean(axis) && all.indexOf(axis) === index)

  const patchArea = (areaIndex: number, patch: (area: ColoredArea) => ColoredArea) =>
    patchActiveFrame((f) => ({ ...f, coloredAreas: f.coloredAreas.map((entry, i) => (i === areaIndex ? patch(entry) : entry)) }))

  const setRange = (areaIndex: number, axis: string, bound: 0 | 1, value: number) =>
    patchArea(areaIndex, (area) => {
      const range: AreaRange = [...(area.axes?.[axis] ?? [null, null])]
      range[bound] = toBound(value)
      return { ...area, axes: { ...area.axes, [axis]: range } }
    })

  // Polygon corners are stored as parallel x/y lists; editing keeps both the same length.
  const setPoint = (areaIndex: number, pointIndex: number, dimension: 'x' | 'y', value: number) =>
    patchArea(areaIndex, (area) => {
      const length = Math.max(area.x.length, area.y.length)
      const x = Array.from({ length }, (_, i) => area.x[i] ?? 0)
      const y = Array.from({ length }, (_, i) => area.y[i] ?? 0)
      const target = dimension === 'x' ? x : y
      target[pointIndex] = numberValue(value, target[pointIndex])
      return { ...area, x, y }
    })
  const addPoint = (areaIndex: number) =>
    patchArea(areaIndex, (area) => ({ ...area, x: [...area.x, area.x.at(-1) ?? 0], y: [...area.y, area.y.at(-1) ?? 0] }))
  const removePoint = (areaIndex: number, pointIndex: number) =>
    patchArea(areaIndex, (area) => ({ ...area, x: area.x.filter((_, i) => i !== pointIndex), y: area.y.filter((_, i) => i !== pointIndex) }))

  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
      <div className="sm:col-span-2 flex items-center gap-2">
        <SectionHeading title={t('coloredAreas')} jsonPath="colored_areas" />
        <Button type="button" size="sm" variant="outline" onClick={() => patchActiveFrame((f) => addColoredAreaToFrame(f))}>+ {t('area')}</Button>
      </div>
      {activeFrame.coloredAreas.map((area, areaIndex) => {
        const usesAxes = area.axes !== undefined
        const pointCount = Math.max(area.x.length, area.y.length)
        return (
          <div key={areaIndex} className={`relative grid gap-3 rounded-lg border p-2 pr-15 sm:col-span-2 sm:grid-cols-2 ${hoveredRemoveGroup === `area-${areaIndex}` ? 'border-red-500' : hoveredDuplicateGroup === `area-${areaIndex}` ? 'border-blue-500' : 'border-zinc-300 dark:border-zinc-700'}`}>
            <DuplicateIconButton onHoverChange={(hovered) => setHoveredDuplicateGroup(hovered ? `area-${areaIndex}` : null)} onClick={() => patchActiveFrame((f) => (
              { ...f, coloredAreas: [...f.coloredAreas.slice(0, areaIndex + 1), structuredClone(f.coloredAreas[areaIndex]), ...f.coloredAreas.slice(areaIndex + 1)] }))} />
            <RemoveIconButton onHoverChange={(hovered) => setHoveredRemoveGroup(hovered ? `area-${areaIndex}` : null)} onClick={() => patchActiveFrame((f) => (
              { ...f, coloredAreas: f.coloredAreas.filter((_, i) => i !== areaIndex) }))} />

            <Field label={t('areaType')} jsonPath={`colored_areas[${areaIndex}].type`} selfClassName="sm:col-span-2">
              <div className="inline-flex w-fit gap-1 rounded-lg border border-zinc-300 p-1 dark:border-zinc-700" role="group">
                <button type="button" aria-pressed={usesAxes} className={segmentClassName(usesAxes)} onClick={() => patchArea(areaIndex, (entry) => ({ ...entry, axes: entry.axes ?? {} }))}>
                  {t('areaTypeAxes')}
                </button>
                <button type="button" aria-pressed={!usesAxes} className={segmentClassName(!usesAxes)} onClick={() => patchArea(areaIndex, (entry) => ({ ...entry, axes: undefined }))}>
                  {t('areaTypePolygon')}
                </button>
              </div>
            </Field>

            {usesAxes ? (
              rangeAxes.length > 0 ? rangeAxes.map((axis) => {
                const range = area.axes?.[axis] ?? [null, null]
                return (
                  <Field key={axis} label={t('areaRange', { axis })} jsonPath={`colored_areas[${areaIndex}].axes.${axis}`}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                      <Input type="number" aria-label={`${axis} ${t('min')}`} placeholder={`${t('min')} (${t('openBound')})`} value={range[0] ?? ''} onChange={(e) => setRange(areaIndex, axis, 0, e.target.valueAsNumber)} />
                      <span className="text-zinc-400">–</span>
                      <Input type="number" aria-label={`${axis} ${t('max')}`} placeholder={`${t('max')} (${t('openBound')})`} value={range[1] ?? ''} onChange={(e) => setRange(areaIndex, axis, 1, e.target.valueAsNumber)} />
                    </div>
                  </Field>
                )
              }) : (
                <p className="m-0 self-center text-xs text-zinc-500 sm:col-span-2">{t('areaAxesHint')}</p>
              )
            ) : (
              <Field label={t('polygonPoints')} jsonPath={`colored_areas[${areaIndex}].points`} selfClassName="sm:col-span-2">
                <div className="grid max-w-xl gap-1.5">
                  <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2 text-xs font-medium text-zinc-500">
                    <span />
                    <span>x{activeFrame.xQuantity ? ` · ${activeFrame.xQuantity}` : ''}</span>
                    <span>y{activeFrame.yQuantity ? ` · ${activeFrame.yQuantity}` : ''}</span>
                    <span />
                  </div>
                  {Array.from({ length: pointCount }, (_, pointIndex) => (
                    <div key={pointIndex} className="grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2">
                      <span className="text-xs text-zinc-500">{t('point', { n: pointIndex + 1 })}</span>
                      <Input type="number" aria-label={`${t('point', { n: pointIndex + 1 })} x`} value={area.x[pointIndex] ?? ''} onChange={(e) => setPoint(areaIndex, pointIndex, 'x', e.target.valueAsNumber)} />
                      <Input type="number" aria-label={`${t('point', { n: pointIndex + 1 })} y`} value={area.y[pointIndex] ?? ''} onChange={(e) => setPoint(areaIndex, pointIndex, 'y', e.target.valueAsNumber)} />
                      <button
                        type="button"
                        className="h-8 rounded text-sm text-zinc-500 hover:bg-red-500 hover:text-white"
                        onClick={() => removePoint(areaIndex, pointIndex)}
                        aria-label={t('removePoint', { n: pointIndex + 1 })}
                        title={t('removePoint', { n: pointIndex + 1 })}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => addPoint(areaIndex)}>+ {t('addPoint')}</Button>
                    {pointCount < 3 ? <span className="text-xs text-amber-600 dark:text-amber-400">{t('polygonHint')}</span> : null}
                  </div>
                </div>
              </Field>
            )}

            <Field label={t('color')} jsonPath={`colored_areas[${areaIndex}].color`}>
              <ColorOrMaterialInput materialColors={materialColors} value={area.color} onChange={(color) => patchArea(areaIndex, (entry) => ({ ...entry, color }))} />
            </Field>
            <Field label={t('alpha')} jsonPath={`colored_areas[${areaIndex}].alpha`}>
              <Input type="number" min={0} max={1} step={0.05} value={area.alpha} onChange={(e) => patchArea(areaIndex, (entry) => ({ ...entry, alpha: numberValue(e.target.valueAsNumber, entry.alpha) }))} />
            </Field>
          </div>
        )
      })}
    </section>
  )
}
