import { Button } from './ui/button'
import { Input } from './ui/input'
import type { FrameConfig } from '../config/defaultPlotConfig'
import { DEFAULT_AREA } from '../config/settingsSections'
import { useI18n } from '../uiTranslations'
import { numberValue } from '../utils/appState'
import { addColoredAreaToFrame } from '../utils/coloredAreas'
import { ColorOrMaterialInput, EmptyItems, Field, FieldGroup, GroupedField, ItemCard, Segmented, SettingsGroup } from './AppControls'
import { useOpenItems } from '../hooks/useOpenItems'

type Props = {
  activeFrame: FrameConfig
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  materialColors: Record<string, string>
}

type ColoredArea = FrameConfig['coloredAreas'][number]
type AreaRange = NonNullable<ColoredArea['axes']>[string]

const toBound = (value: number): number | null => (Number.isFinite(value) ? value : null)
const formatRange = (axis: string, range: AreaRange | undefined) => {
  const [min, max] = range ?? [null, null]
  if (min === null && max === null) return null
  if (max === null) return `${axis} ≥ ${min}`
  if (min === null) return `${axis} ≤ ${max}`
  return `${min} ≤ ${axis} ≤ ${max}`
}

/** Colored areas of the active frame, as a group of the "Areas, guidelines & annotations" section. */
export function ColoredAreasSection({ activeFrame, patchActiveFrame, materialColors }: Props) {
  const { t } = useI18n()
  const openItems = useOpenItems(String(activeFrame._extensions.uiKey))
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
    <SettingsGroup
      title={<>{t('coloredAreas')} <span className="ml-1 font-sans normal-case tracking-normal text-zinc-400">{activeFrame.coloredAreas.length}</span></>}
      actions={<Button type="button" size="sm" variant="outline" data-always onClick={() => {
        openItems.added(activeFrame.coloredAreas.length)
        patchActiveFrame((f) => addColoredAreaToFrame(f))
      }}>+ {t('area')}</Button>}
    >
      <div className="grid gap-2">
        {activeFrame.coloredAreas.length === 0 ? <EmptyItems>{t('noItems')}</EmptyItems> : null}
        {activeFrame.coloredAreas.map((area, areaIndex) => {
          const usesAxes = area.axes !== undefined
          const pointCount = Math.max(area.x.length, area.y.length)
          const summary = usesAxes
            ? rangeAxes.map((axis) => formatRange(axis, area.axes?.[axis])).filter(Boolean).join(' · ')
            : `${t('areaTypePolygon')} · ${pointCount}`
          return (
            <ItemCard
              key={areaIndex}
              icon="▭"
              title={`${t('area')} ${areaIndex + 1}`}
              summary={summary}
              badge={<span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border border-black/20" style={{ backgroundColor: materialColors[area.color] ?? area.color, opacity: Math.max(0.35, area.alpha) }} />}
              open={openItems.isOpen(areaIndex)}
              onOpenChange={(next) => openItems.setOpen(areaIndex, next)}
              onDuplicate={() => {
                openItems.inserted(areaIndex + 1)
                patchActiveFrame((f) => ({ ...f, coloredAreas: [...f.coloredAreas.slice(0, areaIndex + 1), structuredClone(f.coloredAreas[areaIndex]), ...f.coloredAreas.slice(areaIndex + 1)] }))
              }}
              onRemove={() => {
                openItems.removed(areaIndex)
                patchActiveFrame((f) => ({ ...f, coloredAreas: f.coloredAreas.filter((_, i) => i !== areaIndex) }))
              }}
            >
              <Field label={t('areaType')} jsonPath={`colored_areas[${areaIndex}].type`} level="default" changed={!usesAxes}>
                <Segmented<'axes' | 'polygon'>
                  ariaLabel={t('areaType')}
                  value={usesAxes ? 'axes' : 'polygon'}
                  onChange={(next) => patchArea(areaIndex, (entry) => ({ ...entry, axes: next === 'axes' ? entry.axes ?? {} : undefined }))}
                  options={[{ value: 'axes', label: t('areaTypeAxes') }, { value: 'polygon', label: t('areaTypePolygon') }]}
                />
              </Field>

              {usesAxes ? (
                rangeAxes.length > 0 ? (
                  <FieldGroup label={t('areaRanges')} jsonPath={`colored_areas[${areaIndex}].axes.`} level="check" className="@lg:grid-cols-2">
                    {rangeAxes.map((axis) => {
                      const range = area.axes?.[axis] ?? [null, null]
                      return (
                        <GroupedField key={axis} label={axis}>
                          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                            <Input type="number" aria-label={`${axis} ${t('min')}`} placeholder={`${t('min')} (${t('openBound')})`} value={range[0] ?? ''} onChange={(e) => setRange(areaIndex, axis, 0, e.target.valueAsNumber)} />
                            <span className="text-zinc-400">–</span>
                            <Input type="number" aria-label={`${axis} ${t('max')}`} placeholder={`${t('max')} (${t('openBound')})`} value={range[1] ?? ''} onChange={(e) => setRange(areaIndex, axis, 1, e.target.valueAsNumber)} />
                          </div>
                        </GroupedField>
                      )
                    })}
                  </FieldGroup>
                ) : (
                  <p className="m-0 text-xs text-zinc-500">{t('areaAxesHint')}</p>
                )
              ) : (
                <Field label={t('polygonPoints')} jsonPath={`colored_areas[${areaIndex}].points`} level="check">
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

              <div className="grid gap-4 @lg:grid-cols-2">
                <Field label={t('color')} jsonPath={`colored_areas[${areaIndex}].color`} level="check">
                  <ColorOrMaterialInput materialColors={materialColors} value={area.color} onChange={(color) => patchArea(areaIndex, (entry) => ({ ...entry, color }))} />
                </Field>
                <Field label={t('alpha')} jsonPath={`colored_areas[${areaIndex}].alpha`} level="default" changed={area.alpha !== DEFAULT_AREA.alpha}>
                  <Input type="number" min={0} max={1} step={0.05} value={area.alpha} onChange={(e) => patchArea(areaIndex, (entry) => ({ ...entry, alpha: numberValue(e.target.valueAsNumber, entry.alpha) }))} />
                </Field>
              </div>
            </ItemCard>
          )
        })}
      </div>
    </SettingsGroup>
  )
}
