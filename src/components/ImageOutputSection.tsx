import type { DataframeConfig } from '../config/defaultPlotConfig'
import { DEFAULT_DATAFRAME } from '../config/settingsSections'
import { useI18n } from '../uiTranslations'
import { numberValue } from '../utils/appState'
import { Field, Segmented, Toggle } from './AppControls'
import { Input } from './ui/input'

type Props = {
  activeDataframe: DataframeConfig
  patchActiveDataframe: (patch: (current: DataframeConfig) => DataframeConfig) => void
}

/** How the image file is written; shared by all frames of the dataframe. */
export function ImageOutputSection({ activeDataframe, patchActiveDataframe }: Props) {
  const { t } = useI18n()
  const isPng = activeDataframe.fileformat === 'png'
  return (
    <div className="grid gap-4 @lg:grid-cols-3">
      <Field label={t('fileFormat')} jsonPath="dataframes[i].resolution" level="default" changed={activeDataframe.fileformat !== DEFAULT_DATAFRAME.fileformat}>
        <Segmented<'svg' | 'png'>
          ariaLabel={t('fileFormat')}
          value={activeDataframe.fileformat}
          onChange={(fileformat) => patchActiveDataframe((current) => ({ ...current, fileformat }))}
          options={[{ value: 'svg', label: 'SVG' }, { value: 'png', label: 'PNG' }]}
        />
      </Field>
      <Field label={t('resolutionDpi')} jsonPath="dataframes[i].resolution" level="default" changed={activeDataframe.resolution !== DEFAULT_DATAFRAME.resolution} hint={t('dpiHint')}>
        <Input
          type="number"
          min={1}
          disabled={!isPng}
          value={activeDataframe.resolution}
          onChange={(event) => patchActiveDataframe((current) => ({ ...current, resolution: numberValue(event.target.valueAsNumber, current.resolution) }))}
        />
      </Field>
      <span className="hidden @lg:block" />
      <Field label={t('transparent')} jsonPath="dataframes[i].transparent" level="default" changed={activeDataframe.transparent !== DEFAULT_DATAFRAME.transparent}>
        <Toggle checked={activeDataframe.transparent} label={t('transparent')} onChange={(transparent) => patchActiveDataframe((current) => ({ ...current, transparent }))} />
      </Field>
      <Field label={t('watermark')} jsonPath="dataframes[i].watermark" level="default" changed={Boolean(activeDataframe.watermark) !== Boolean(DEFAULT_DATAFRAME.watermark)}>
        <Toggle checked={Boolean(activeDataframe.watermark)} label={t('watermark')} onChange={(watermark) => patchActiveDataframe((current) => ({ ...current, watermark }))} />
      </Field>
      <Field label={t('copyright')} jsonPath="dataframes[i].copyright" level="default" changed={Boolean(activeDataframe.copyright) !== Boolean(DEFAULT_DATAFRAME.copyright)}>
        <Toggle checked={Boolean(activeDataframe.copyright)} label={t('copyright')} onChange={(copyright) => patchActiveDataframe((current) => ({ ...current, copyright }))} />
      </Field>
    </div>
  )
}
