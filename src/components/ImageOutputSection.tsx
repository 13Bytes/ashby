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

/** Shape, background and file of the plot image; shared by all frames of the dataframe. */
export function ImageOutputSection({ activeDataframe, patchActiveDataframe }: Props) {
  const { t } = useI18n()
  const isPng = activeDataframe.fileformat === 'png'
  return (
    <div className="grid gap-4 @lg:grid-cols-3">
      <Field label={t('aspectRatio')} jsonPath="dataframes[i].image_ratio" level="default" changed={activeDataframe.aspectRatio.join(':') !== DEFAULT_DATAFRAME.aspectRatio.join(':')}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Input
            type="number"
            step="0.01"
            aria-label={`${t('aspectRatio')} 1`}
            value={activeDataframe.aspectRatio[0]}
            onChange={(event) => patchActiveDataframe((current) => ({ ...current, aspectRatio: [numberValue(event.target.valueAsNumber, current.aspectRatio[0]), current.aspectRatio[1]] }))}
          />
          <span>/</span>
          <Input
            type="number"
            step="0.01"
            aria-label={`${t('aspectRatio')} 2`}
            value={activeDataframe.aspectRatio[1]}
            onChange={(event) => patchActiveDataframe((current) => ({ ...current, aspectRatio: [current.aspectRatio[0], numberValue(event.target.valueAsNumber, current.aspectRatio[1])] }))}
          />
        </div>
      </Field>
      <Field label={t('fileFormat')} jsonPath="dataframes[i].fileformat" level="default" changed={activeDataframe.fileformat !== DEFAULT_DATAFRAME.fileformat}>
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
      <Field label={t('DarkMode')} jsonPath="dataframes[i].dark_mode" level="default" changed={activeDataframe.darkMode !== DEFAULT_DATAFRAME.darkMode}>
        <Toggle checked={activeDataframe.darkMode} label={t('DarkMode')} onChange={(darkMode) => patchActiveDataframe((current) => ({ ...current, darkMode }))} />
      </Field>
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
