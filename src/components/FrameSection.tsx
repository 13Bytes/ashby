import { PLOT_ALGORITHMS, type DataframeConfig, type FrameConfig } from '../config/defaultPlotConfig'
import { useI18n } from '../uiTranslations'
import { numberValue } from '../utils/appState'
import { Field } from './AppControls'
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

  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
      <h3 className="sm:col-span-2 m-0 text-m font-semibold text-violet-500">{t('frame')}</h3>
      <div className="grid gap-3 dark:border-zinc-800 dark:bg-transparent sm:col-span-2 sm:grid-cols-4">
        <Field selfClassName="sm:col-span-2" label={t('exportFileName')} jsonPath="frames[j].export_file_name">
          <Input value={activeFrame.exportFileName ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, exportFileName: e.target.value || undefined }))} />
        </Field>
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
      <div className="grid gap-2">
        <label className="font-medium text-zinc-900 dark:text-zinc-100">{t('title')}</label>
        {activeDataframe.plotLanguages.map((lang) => (
          <div key={`title-${lang}`} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
            <span className="text-xs uppercase text-zinc-600 dark:text-zinc-300">{lang}</span>
            <Input value={activeFrame.title[lang] ?? ''} onChange={(e) => patchActiveFrame((c) => ({ ...c, title: { ...c.title, [lang]: e.target.value } }))} />
          </div>
        ))}
      </div>
      <div className="grid gap-2">
        <label className="font-medium text-zinc-900 dark:text-zinc-100">{t('legendTitle')}</label>
        {activeDataframe.plotLanguages.map((lang) => (
          <div key={`legend-${lang}`} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
            <span className="text-xs uppercase text-zinc-600 dark:text-zinc-300">{lang}</span>
            <Input value={activeDataframe.legendTitle[lang] ?? ''} onChange={(e) => patchActiveDataframe((c) => ({ ...c, legendTitle: { ...c.legendTitle, [lang]: e.target.value } }))} />
          </div>
        ))}
      </div>
    </section>
  )
}
