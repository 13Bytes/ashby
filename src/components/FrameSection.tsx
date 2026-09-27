import { PLOT_ALGORITHMS, type DataframeConfig, type FrameConfig } from '../config/defaultPlotConfig'
import { useI18n } from '../uiTranslations'
import { numberValue } from '../utils/appState'
import { Field, SectionHeading } from './AppControls'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'

type Props = {
  activeFrame: FrameConfig
  activeDataframe: DataframeConfig
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  patchActiveDataframe: (updater: (dataframe: DataframeConfig) => DataframeConfig) => void
  automaticDisplayAreaActive: boolean
}

type Margin = NonNullable<FrameConfig['automaticDisplayAreaMargin']>
type Limits = NonNullable<FrameConfig['xLim']>

const EMPTY_MARGIN: Margin = { left: 0, right: 0, top: 0, bottom: 0 }

/** Empty input means "no limit" (null in the exported config), so the backend picks the bound automatically. */
const withLimit = (limits: FrameConfig['xLim'], bound: 0 | 1, value: number): Limits => {
  const next: Limits = [limits?.[0], limits?.[1]]
  next[bound] = Number.isFinite(value) ? value : undefined
  return next
}

export function FrameSection({ activeFrame, activeDataframe, patchActiveFrame, patchActiveDataframe, automaticDisplayAreaActive }: Props) {
  const { t } = useI18n()
  const setMargin = (side: keyof Margin, value: number) =>
    patchActiveFrame((c) => {
      const margin = c.automaticDisplayAreaMargin ?? EMPTY_MARGIN
      return { ...c, automaticDisplayAreaMargin: { ...margin, [side]: numberValue(value, margin[side]) } }
    })

  const limitField = (axis: 'x' | 'y', bound: 0 | 1, side: keyof Margin) => {
    const limitKey = axis === 'x' ? 'xLim' : 'yLim'
    return (
      <Field
       
        label={automaticDisplayAreaActive ? t(side) : bound === 0 ? t('min') : t('max')}
        jsonPath={automaticDisplayAreaActive ? `automatic_Display_Area_margin.${side}` : `${axis}_lim[${bound}]`}
      >
        <Input
          type="number"
          value={automaticDisplayAreaActive ? (activeFrame.automaticDisplayAreaMargin?.[side] ?? 0) : (activeFrame[limitKey]?.[bound] ?? '')}
          onChange={(e) => automaticDisplayAreaActive
            ? setMargin(side, e.target.valueAsNumber)
            : patchActiveFrame((c) => ({ ...c, [limitKey]: withLimit(c[limitKey], bound, e.target.valueAsNumber) }))}
        />
      </Field>
    )
  }

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

  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
      <SectionHeading className="sm:col-span-2" title={t('frame')} />
      <div className="grid gap-3 dark:border-zinc-800 dark:bg-transparent sm:col-span-2 sm:grid-cols-4">
        <Field label={t('algorithm')} jsonPath="frames[j].algorithm">
          <Select value={activeFrame.algorithm} onChange={(e) => patchActiveFrame((c) => ({ ...c, algorithm: e.target.value as FrameConfig['algorithm'] }))}>
            {PLOT_ALGORITHMS.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </Field>
        <Field label={t('automaticDisplayArea')} jsonPath="automatic_Display_Area_margin">
          <Button type="button" variant="outline" onClick={() => patchActiveFrame((c) => ({ ...c, automaticDisplayAreaMargin: c.automaticDisplayAreaMargin ? null : { ...EMPTY_MARGIN } }))}>
            {automaticDisplayAreaActive ? t('enabled') : t('disabled')}
          </Button>
        </Field>
      </div>
      <div className="sm:col-span-2 grid gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
        <h4 className="m-0 text-sm font-semibold">{t('xAxis')}</h4>
        <div className="grid gap-2 sm:grid-cols-4">
          <Field label={t('quantity')} jsonPath="x_quantity">
            <Select value={activeFrame.xQuantity ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, xQuantity: e.target.value || undefined }))}>
              <option value="" disabled>{t('selectRequiredAxis')}</option>
              {axisOptions}
            </Select>
          </Field>
          <Field label={t('relativeQuantity')} jsonPath="x_rel_quantity">
            <Select value={activeFrame.xRelQuantity ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, xRelQuantity: e.target.value || undefined }))}>
              <option value="">{t('none')}</option>{axisOptions}
            </Select>
          </Field>
          <Field label={t('Logarithmic')} jsonPath="log_x_flag">
            <Button type="button" variant="outline" onClick={() => patchActiveFrame((c) => ({ ...c, logXFlag: !c.logXFlag }))}>{activeFrame.logXFlag ? t('scaleLog') : t('scaleLinear')}</Button>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {limitField('x', 0, 'left')}
            {limitField('x', 1, 'right')}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center sm:col-span-2 sm:-my-1">
        <button
          type="button"
          aria-label={t('swapAxes')}
          title={t('swapAxes')}
          onClick={swapAxes}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-500 hover:border-violet-500 hover:text-violet-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-violet-400 dark:hover:text-violet-300"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="M4 13h9m0 0l-3-3m3 3l-3 3" />
            <path d="M16 7H7m0 0l3 3m-3-3l3-3" />
          </svg>
        </button>
      </div>
      <div className="sm:col-span-2 grid gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
        <h4 className="m-0 text-sm font-semibold">{t('yAxis')}</h4>
        <div className="grid gap-2 sm:grid-cols-4">
          <Field label={t('quantity')} jsonPath="y_quantity">
            <Select value={activeFrame.yQuantity ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, yQuantity: e.target.value || undefined }))}>
              <option value="" disabled>{t('selectRequiredAxis')}</option>
              {axisOptions}
            </Select>
          </Field>
          <Field label={t('relativeQuantity')} jsonPath="y_rel_quantity">
            <Select value={activeFrame.yRelQuantity ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, yRelQuantity: e.target.value || undefined }))}>
              <option value="">{t('none')}</option>{axisOptions}
            </Select>
          </Field>
          <Field label={t('Logarithmic')} jsonPath="log_y_flag">
            <Button type="button" variant="outline" onClick={() => patchActiveFrame((c) => ({ ...c, logYFlag: !c.logYFlag }))}>{activeFrame.logYFlag ? t('scaleLog') : t('scaleLinear')}</Button>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {limitField('y', 0, 'bottom')}
            {limitField('y', 1, 'top')}
          </div>
        </div>
      </div>
      <Field label={t('title')} jsonPath="frames[j].title">
        {activeDataframe.plotLanguages.map((lang) => (
          <div key={`title-${lang}`} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
            <span className="text-xs uppercase text-zinc-600 dark:text-zinc-300">{lang}</span>
            <Input value={activeFrame.title[lang] ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, title: { ...c.title, [lang]: e.target.value } }))} />
          </div>
        ))}
      </Field>
      <Field label={t('legendTitle')} jsonPath="dataframes[i].legend_title">
        {activeDataframe.plotLanguages.map((lang) => (
          <div key={`legend-${lang}`} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
            <span className="text-xs uppercase text-zinc-600 dark:text-zinc-300">{lang}</span>
            <Input value={activeDataframe.legendTitle[lang] ?? ''} onChange={(e) => patchActiveDataframe((c) => ({ ...c, legendTitle: { ...c.legendTitle, [lang]: e.target.value } }))} />
          </div>
        ))}
      </Field>
    </section>
  )
}
