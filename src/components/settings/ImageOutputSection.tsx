import type { DataframeConfig } from '../../config/defaultPlotConfig'
import { DEFAULT_DATAFRAME } from '../../config/settingsSections'
import { useI18n } from '../../uiTranslations'
import { formatAspectRatio, isSameAspectRatio, parseAspectRatio, parsePositiveInteger } from '../../utils/appState'
import { useAttributionUnlocked } from '../../utils/attributionKey'
import { Field, PresetInput, Toggle, Switch } from '../common/AppControls'

type Props = {
  activeDataframe: DataframeConfig
  patchActiveDataframe: (patch: (current: DataframeConfig) => DataframeConfig) => void
}

const ASPECT_RATIO_PRESETS: Array<{ value: [number, number]; label: string }> = [
  { value: [1, 1], label: '1:1' },
  { value: [4, 3], label: '4:3' },
  { value: [3, 2], label: '3:2' },
  { value: [16, 9], label: '16:9' },
]
const RESOLUTION_PRESETS = [100, 150, 300, 600].map((value) => ({ value, label: String(value) }))

/** Shape, background and file of the plot image; shared by all frames of the dataframe. */
export function ImageOutputSection({ activeDataframe, patchActiveDataframe }: Props) {
  const { t } = useI18n()
  const isPng = activeDataframe.fileformat === 'png'
  const attributionUnlocked = useAttributionUnlocked()
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-4">
        <Field label={t('aspectRatio')} jsonPath="dataframes[i].image_ratio" level="default" changed={!isSameAspectRatio(activeDataframe.aspectRatio, DEFAULT_DATAFRAME.aspectRatio)} onReset={() => patchActiveDataframe((current) => ({ ...current, aspectRatio: DEFAULT_DATAFRAME.aspectRatio }))}>
          <PresetInput
            ariaLabel={t('aspectRatio')}
            presets={ASPECT_RATIO_PRESETS}
            value={activeDataframe.aspectRatio}
            isSame={isSameAspectRatio}
            format={formatAspectRatio}
            parse={parseAspectRatio}
            onChange={(aspectRatio) => patchActiveDataframe((current) => ({ ...current, aspectRatio }))}
          />
        </Field>
        <Field label={t('fileFormat')} jsonPath="dataframes[i].fileformat" level="default" changed={activeDataframe.fileformat !== DEFAULT_DATAFRAME.fileformat} onReset={() => patchActiveDataframe((current) => ({ ...current, fileformat: DEFAULT_DATAFRAME.fileformat }))}>
          <Toggle<'svg' | 'png'>
            ariaLabel={t('fileFormat')}
            value={activeDataframe.fileformat}
            onChange={(fileformat) => patchActiveDataframe((current) => ({ ...current, fileformat }))}
            options={[{ value: 'svg', label: 'SVG' }, { value: 'png', label: 'PNG' }]}
          />
        </Field>
        <Field label={t('resolutionDpi')} jsonPath="dataframes[i].resolution" level="default" changed={activeDataframe.resolution !== DEFAULT_DATAFRAME.resolution} onReset={() => patchActiveDataframe((current) => ({ ...current, resolution: DEFAULT_DATAFRAME.resolution }))} hint={t('dpiHint')}>
          <PresetInput
            ariaLabel={t('resolutionDpi')}
            presets={RESOLUTION_PRESETS}
            value={activeDataframe.resolution}
            isSame={(a, b) => a === b}
            format={String}
            parse={parsePositiveInteger}
            onChange={(resolution) => patchActiveDataframe((current) => ({ ...current, resolution }))}
            disabled={!isPng}
          />
        </Field>
      </div>
      {/* The switches in one row; copyright and watermark only with the attribution key. */}
      <div className="grid grid-cols-2 gap-4 @lg:grid-cols-4">
        <Field label={t('DarkMode')} jsonPath="dataframes[i].dark_mode" level="default" changed={activeDataframe.darkMode !== DEFAULT_DATAFRAME.darkMode} onReset={() => patchActiveDataframe((current) => ({ ...current, darkMode: DEFAULT_DATAFRAME.darkMode }))}>
          <Switch checked={activeDataframe.darkMode} label={t('DarkMode')} onChange={(darkMode) => patchActiveDataframe((current) => ({ ...current, darkMode }))} />
        </Field>
        <Field label={t('transparent')} jsonPath="dataframes[i].transparent" level="default" changed={activeDataframe.transparent !== DEFAULT_DATAFRAME.transparent} onReset={() => patchActiveDataframe((current) => ({ ...current, transparent: DEFAULT_DATAFRAME.transparent }))}>
          <Switch checked={activeDataframe.transparent} label={t('transparent')} onChange={(transparent) => patchActiveDataframe((current) => ({ ...current, transparent }))} />
        </Field>
        {attributionUnlocked && (
          <>
            <Field label={t('watermark')} jsonPath="dataframes[i].watermark" level="default" changed={activeDataframe.watermark !== DEFAULT_DATAFRAME.watermark} onReset={() => patchActiveDataframe((current) => ({ ...current, watermark: DEFAULT_DATAFRAME.watermark }))}>
              <Switch checked={activeDataframe.watermark} label={t('watermark')} onChange={(watermark) => patchActiveDataframe((current) => ({ ...current, watermark }))} />
            </Field>
            <Field label={t('copyright')} jsonPath="dataframes[i].copyright" level="default" changed={activeDataframe.copyright !== DEFAULT_DATAFRAME.copyright} onReset={() => patchActiveDataframe((current) => ({ ...current, copyright: DEFAULT_DATAFRAME.copyright }))}>
              <Switch checked={activeDataframe.copyright} label={t('copyright')} onChange={(copyright) => patchActiveDataframe((current) => ({ ...current, copyright }))} />
            </Field>
          </>
        )}
      </div>
    </div>
  )
}
