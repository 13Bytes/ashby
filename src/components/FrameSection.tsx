import { MARGIN_SIDES, type AxisMargin, type DataframeConfig, type FrameConfig, type MarginSide } from '../config/defaultPlotConfig'
import { DEFAULT_MARGIN } from '../config/settingsSections'
import { useAxesWarning } from '../hooks/useAxesWarning'
import { useI18n } from '../uiTranslations'
import { numberValue } from '../utils/appState'
import { plotAxesOf } from '../utils/configEditing'
import { useSettings } from '../utils/settingsContext'
import { Field, FieldGroup, GroupedField, LanguageFields, Toggle, SettingsGroup, SharedHint } from './AppControls'
import { Input } from './ui/input'
import { Select } from './ui/select'

type Props = {
  activeFrame: FrameConfig
  activeDataframe: DataframeConfig
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
}

/** The axis and bound each side of the axis margin belongs to. */
const SIDE_BOUNDS: Record<MarginSide, ['X' | 'Y', 'min' | 'max']> = { left: ['X', 'min'], right: ['X', 'max'], bottom: ['Y', 'min'], top: ['Y', 'max'] }
/** Where a side ends up when the x and y axis are swapped. */
const SWAPPED_SIDE: Record<MarginSide, MarginSide> = { left: 'bottom', right: 'top', bottom: 'left', top: 'right' }

const swapMargin = (margin: AxisMargin): AxisMargin => ({
  left: margin.bottom,
  right: margin.top,
  bottom: margin.left,
  top: margin.right,
  absolute: margin.absolute.map((side) => SWAPPED_SIDE[side]),
  plotAxes: margin.plotAxes && [margin.plotAxes[1], margin.plotAxes[0]],
})

/** Title, the two axes and the display area of the active frame. */
export function FrameSection({ activeFrame, activeDataframe, patchActiveFrame }: Props) {
  const { t } = useI18n()
  const { goTo } = useSettings()
  const axesWarning = useAxesWarning(activeFrame)
  const margin = activeFrame.axisMargin
  const marginChanged = MARGIN_SIDES.some((side) => margin[side] !== DEFAULT_MARGIN) || margin.absolute.length > 0
  // Fixed values are coordinates on the axes; note the axes they were entered for.
  const patchMargin = (patch: (margin: AxisMargin) => Partial<AxisMargin>) =>
    patchActiveFrame((c) => {
      const next = { ...c.axisMargin, ...patch(c.axisMargin) }
      return { ...c, axisMargin: next.absolute.length > 0 ? { ...next, plotAxes: plotAxesOf(c) } : next }
    })
  const setMarginValue = (side: MarginSide, value: number) => patchMargin((current) => ({ [side]: numberValue(value, current[side]) }))
  const setMarginAbsolute = (side: MarginSide, absolute: boolean) =>
    patchMargin((current) => ({ absolute: absolute ? [...current.absolute.filter((entry) => entry !== side), side] : current.absolute.filter((entry) => entry !== side) }))
  const axisOptions = activeDataframe.axes.map((axis) => <option key={axis.name} value={axis.name}>{axis.name}</option>)
  // Values that belong to an axis move with it: fixed limits, and polygon corners, which are plot coordinates.
  const swapAxes = () => patchActiveFrame((c) => ({
    ...c,
    xQuantity: c.yQuantity,
    yQuantity: c.xQuantity,
    xRelQuantity: c.yRelQuantity,
    yRelQuantity: c.xRelQuantity,
    logXFlag: c.logYFlag,
    logYFlag: c.logXFlag,
    axisMargin: swapMargin(c.axisMargin),
    coloredAreas: c.coloredAreas.map((area) => (area.axes ? area : { ...area, x: area.y, y: area.x, plotAxes: area.plotAxes && [area.plotAxes[1], area.plotAxes[0]] })),
  }))

  const axisBox = (axis: 'x' | 'y') => {
    const quantity = axis === 'x' ? activeFrame.xQuantity : activeFrame.yQuantity
    const relQuantity = axis === 'x' ? activeFrame.xRelQuantity : activeFrame.yRelQuantity
    const logFlag = axis === 'x' ? activeFrame.logXFlag : activeFrame.logYFlag
    const title = axis === 'x' ? t('xAxis') : t('yAxis')
    return (
      <div className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <strong className="text-sm">{title}</strong>
        <div className="grid gap-4 @lg:grid-cols-3">
          <Field label={t('quantity')} jsonPath={`${axis}_quantity`} level="required" missing={!quantity} anchor={axis === 'x' ? 'xAxis' : 'yAxis'}>
            <Select value={quantity ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, [axis === 'x' ? 'xQuantity' : 'yQuantity']: e.target.value || undefined }))}>
              <option value="" disabled>{t('selectRequiredAxis')}</option>
              {axisOptions}
            </Select>
          </Field>
          <Field label={t('Logarithmic')} jsonPath={`log_${axis}_flag`} level="check">
            <Toggle<'linear' | 'log'>
              ariaLabel={`${title} ${t('Logarithmic')}`}
              value={logFlag ? 'log' : 'linear'}
              onChange={(next) => patchActiveFrame((c) => ({ ...c, [axis === 'x' ? 'logXFlag' : 'logYFlag']: next === 'log' }))}
              options={[{ value: 'linear', label: t('scaleLinear') }, { value: 'log', label: t('scaleLog') }]}
            />
          </Field>
          <Field label={t('relativeQuantity')} jsonPath={`${axis}_rel_quantity`} level="default" changed={Boolean(relQuantity)}>
            <Select value={relQuantity ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, [axis === 'x' ? 'xRelQuantity' : 'yRelQuantity']: e.target.value || undefined }))}>
              <option value="">{t('none')}</option>
              {axisOptions}
            </Select>
          </Field>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 @lg:grid-cols-2">
        <LanguageFields
          label={t('title')}
          jsonPath="frames[j].title"
          level="check"
          languages={activeDataframe.plotLanguages}
          selectedLanguage={activeDataframe.language}
          value={(lang) => activeFrame.title[lang] ?? ''}
          onChange={(lang, next) => patchActiveFrame((c) => ({ ...c, title: { ...c.title, [lang]: next } }))}
        />
      </div>

      {axisBox('x')}
      <div className="-my-3 flex justify-center" data-always>
        <button
          type="button"
          aria-label={t('swapAxes')}
          title={t('swapAxes')}
          onClick={swapAxes}
          className="flex h-7 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 text-xs text-zinc-600 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-brand-400 dark:hover:text-brand-300"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M7 4v12m0 0l-3-3m3 3l3-3" />
            <path d="M13 16V4m0 0l-3 3m3-3l3 3" />
          </svg>
          {t('swapAxes')}
        </button>
      </div>
      {axisBox('y')}

      <SharedHint text={t('quantitiesFromDefs')} linkLabel={t('editAxisDefs')} onOpen={() => goTo('axisDefs')} />

      <SettingsGroup title={t('displayArea')} level="default">
        <FieldGroup
          label={t('axisLimits')}
          jsonPath="axis_margin.left"
          level="default"
          changed={marginChanged}
          columns="responsive"
          warning={margin.absolute.length > 0 ? axesWarning(margin.plotAxes) : undefined}
        >
          {MARGIN_SIDES.map((side) => {
            const absolute = margin.absolute.includes(side)
            const [axis, bound] = SIDE_BOUNDS[side]
            const tag = `${axis} ${t(bound)}`
            return (
              <GroupedField key={side} tag={tag} title={`${tag} (${t(side)})`}>
                <Input type="number" step={absolute ? 'any' : 0.01} aria-label={`${t('axisLimits')}: ${tag}`} value={margin[side]} onChange={(e) => setMarginValue(side, e.target.valueAsNumber)} />
                <Toggle<'relative' | 'absolute'>
                  size="sm"
                  ariaLabel={`${t('axisLimits')}: ${tag}`}
                  value={absolute ? 'absolute' : 'relative'}
                  onChange={(next) => setMarginAbsolute(side, next === 'absolute')}
                  options={[{ value: 'relative', label: t('marginRelative'), title: t('marginRelativeTitle') }, { value: 'absolute', label: t('marginAbsolute'), title: t('marginAbsoluteTitle') }]}
                />
              </GroupedField>
            )
          })}
        </FieldGroup>
      </SettingsGroup>
    </>
  )
}
