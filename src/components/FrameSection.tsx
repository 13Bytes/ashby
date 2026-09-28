import type { DataframeConfig, FrameConfig } from '../config/defaultPlotConfig'
import { DEFAULT_FRAME, DEFAULT_MARGIN } from '../config/settingsSections'
import { useI18n } from '../uiTranslations'
import { numberValue } from '../utils/appState'
import { useSettings } from '../utils/settingsContext'
import { Field, LanguageFields, Segmented, SettingsGroup, SharedHint, Toggle } from './AppControls'
import { Input } from './ui/input'
import { Select } from './ui/select'

type Props = {
  activeFrame: FrameConfig
  activeDataframe: DataframeConfig
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  automaticDisplayAreaActive: boolean
}

type LegendPosition = 'right' | 'above' | 'none'
type FrameDarkMode = 'dataset' | 'off' | 'on'
type Margin = NonNullable<FrameConfig['automaticDisplayAreaMargin']>
type Limits = NonNullable<FrameConfig['xLim']>

const EMPTY_MARGIN: Margin = { left: 0, right: 0, top: 0, bottom: 0 }
const DEFAULT_MARGINS: Margin = { left: DEFAULT_MARGIN, right: DEFAULT_MARGIN, top: DEFAULT_MARGIN, bottom: DEFAULT_MARGIN }

/** Empty input means "no limit" (null in the exported config), so the backend picks the bound automatically. */
const withLimit = (limits: FrameConfig['xLim'], bound: 0 | 1, value: number): Limits => {
  const next: Limits = [limits?.[0], limits?.[1]]
  next[bound] = Number.isFinite(value) ? value : undefined
  return next
}

/** Title, the two axes and the display area of the active frame. */
export function FrameSection({ activeFrame, activeDataframe, patchActiveFrame, automaticDisplayAreaActive }: Props) {
  const { t } = useI18n()
  const { goTo } = useSettings()
  const margins = activeFrame.automaticDisplayAreaMargin
  const marginsChanged = automaticDisplayAreaActive && (['left', 'right', 'top', 'bottom'] as const).some((side) => (margins?.[side] ?? 0) !== DEFAULT_MARGIN)
  const setMargin = (side: keyof Margin, value: number) =>
    patchActiveFrame((c) => {
      const margin = c.automaticDisplayAreaMargin ?? EMPTY_MARGIN
      return { ...c, automaticDisplayAreaMargin: { ...margin, [side]: numberValue(value, margin[side]) } }
    })
  const axisOptions = activeDataframe.axes.map((axis) => <option key={axis.name} value={axis.name}>{axis.name}</option>)
  const swapAxes = () => patchActiveFrame((c) => ({
    ...c,
    xQuantity: c.yQuantity,
    yQuantity: c.xQuantity,
    xRelQuantity: c.yRelQuantity,
    yRelQuantity: c.xRelQuantity,
    logXFlag: c.logYFlag,
    logYFlag: c.logXFlag,
    xLim: c.yLim,
    yLim: c.xLim,
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
            <Segmented<'linear' | 'log'>
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

  const limitsChanged = !automaticDisplayAreaActive && [activeFrame.xLim?.[0], activeFrame.xLim?.[1], activeFrame.yLim?.[0], activeFrame.yLim?.[1]].some((value) => value !== undefined)

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

      <div className="flex flex-wrap gap-4">
        <Field label={t('legendPosition')} jsonPath="frames[j].legend_above" level="default" changed={activeFrame.legendAbove !== DEFAULT_FRAME.legendAbove}>
          <Segmented<LegendPosition>
            ariaLabel={t('legendPosition')}
            value={activeFrame.legendAbove === null ? 'none' : activeFrame.legendAbove ? 'above' : 'right'}
            onChange={(next) => patchActiveFrame((c) => ({ ...c, legendAbove: next === 'none' ? null : next === 'above' }))}
            options={[{ value: 'right', label: t('legendRight') }, { value: 'above', label: t('legendAbove') }, { value: 'none', label: t('legendNone') }]}
          />
        </Field>
        <Field label={t('frameDarkMode')} jsonPath="frames[j].dark_mode" level="default" changed={activeFrame.darkMode !== undefined}>
          <Segmented<FrameDarkMode>
            ariaLabel={t('frameDarkMode')}
            value={activeFrame.darkMode === undefined ? 'dataset' : activeFrame.darkMode ? 'on' : 'off'}
            onChange={(next) => patchActiveFrame((c) => ({ ...c, darkMode: next === 'dataset' ? undefined : next === 'on' }))}
            options={[
              { value: 'dataset', label: t('asDataset', { value: activeDataframe.darkMode ? t('on') : t('off') }) },
              { value: 'off', label: t('off') },
              { value: 'on', label: t('on') },
            ]}
          />
        </Field>
      </div>

      {axisBox('x')}
      <div className="-my-3 flex justify-center" data-always>
        <button
          type="button"
          aria-label={t('swapAxes')}
          title={t('swapAxes')}
          onClick={swapAxes}
          className="flex h-7 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 text-xs text-zinc-600 hover:border-violet-500 hover:text-violet-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-violet-400 dark:hover:text-violet-300"
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
        <Field label={t('automaticDisplayArea')} jsonPath="automatic_Display_Area_margin" level="default" changed={!automaticDisplayAreaActive}>
          <Toggle
            checked={automaticDisplayAreaActive}
            label={t('automaticDisplayArea')}
            onChange={(next) => patchActiveFrame((c) => ({ ...c, automaticDisplayAreaMargin: next ? { ...DEFAULT_MARGINS } : null }))}
          />
        </Field>
        {automaticDisplayAreaActive ? (
          <Field label={t('marginsLabel')} jsonPath="automatic_Display_Area_margin" level="default" changed={marginsChanged}>
            <div className="grid gap-3 @lg:grid-cols-4">
              {(['left', 'right', 'bottom', 'top'] as const).map((side) => (
                <label key={side} className="grid gap-1 text-xs text-zinc-500">
                  {t(side)}
                  <Input type="number" step={0.01} value={margins?.[side] ?? 0} onChange={(e) => setMargin(side, e.target.valueAsNumber)} />
                </label>
              ))}
            </div>
          </Field>
        ) : (
          <Field label={t('fixedLimits')} jsonPath="x_lim[0]" level="default" changed={limitsChanged}>
            <div className="grid gap-3 @lg:grid-cols-4">
              {([['x', 0], ['x', 1], ['y', 0], ['y', 1]] as const).map(([axis, bound]) => {
                const key = axis === 'x' ? 'xLim' : 'yLim'
                return (
                  <label key={`${axis}${bound}`} className="grid gap-1 text-xs text-zinc-500">
                    {`${axis.toUpperCase()} ${bound === 0 ? t('min') : t('max')}`}
                    <Input type="number" value={activeFrame[key]?.[bound] ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, [key]: withLimit(c[key], bound, e.target.valueAsNumber) }))} />
                  </label>
                )
              })}
            </div>
          </Field>
        )}
      </SettingsGroup>
    </>
  )
}
