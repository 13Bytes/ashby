import type { KeyboardEvent } from 'react'
import type { DataframeConfig } from '../config/defaultPlotConfig'
import { DEFAULT_DATAFRAME } from '../config/settingsSections'
import { CUSTOM_SELECT_VALUE, FONT_FAMILY_OPTIONS, FONT_STYLE_OPTIONS } from '../config/uiOptions'
import { useI18n } from '../uiTranslations'
import { numberValue } from '../utils/appState'
import { Field, SettingsGroup, Toggle } from './AppControls'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'

type Props = {
  activeDataframe: DataframeConfig
  patchActiveDataframe: (patch: (current: DataframeConfig) => DataframeConfig) => void
  plotLanguageDraft: string
  setPlotLanguageDraft: (value: string) => void
  handlePlotLanguageKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  addPlotLanguage: (language: string) => void
  updateLanguages: (next: string[]) => void
}

type FontKey = 'fontSize' | 'titleSize' | 'legendTitleSize' | 'legendLabelSize' | 'axisLabelSize' | 'tickSize'

/** Plot languages, the look of the plot and its fonts; shared by all frames of the dataframe. */
export function TextLookSection({
  activeDataframe,
  patchActiveDataframe,
  plotLanguageDraft,
  setPlotLanguageDraft,
  handlePlotLanguageKeyDown,
  addPlotLanguage,
  updateLanguages,
}: Props) {
  const { t } = useI18n()
  const font = activeDataframe.font
  const defaultFont = DEFAULT_DATAFRAME.font
  const isKnownFontFamily = FONT_FAMILY_OPTIONS.includes(font.font)
  const setFont = (key: FontKey, value: number) =>
    patchActiveDataframe((current) => ({ ...current, font: { ...current.font, [key]: numberValue(value, current.font[key]) } }))
  const fontNumber = (key: FontKey, label: string, path: string) => (
    <Field label={label} jsonPath={path} level="default" changed={font[key] !== defaultFont[key]}>
      <Input type="number" value={font[key]} onChange={(event) => setFont(key, event.target.valueAsNumber)} />
    </Field>
  )

  return (
    <>
      <Field label={t('plotLanguage')} jsonPath="dataframes[i].language" level="check">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t('plotLanguage')} className="inline-flex flex-wrap gap-1">
            {activeDataframe.plotLanguages.map((language) => {
              const selected = activeDataframe.language === language
              return (
                <span key={language} className={`inline-flex items-center overflow-hidden rounded-full border text-xs ${selected ? 'border-violet-600' : 'border-zinc-300 dark:border-zinc-700'}`}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    className={`px-3 py-1 font-mono uppercase ${selected ? 'bg-violet-600 text-white hover:bg-violet-500' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                    // Frames have their own `language` (no control of its own) that overrides the
                    // dataframe's; the plot language applies to every frame of the dataframe.
                    onClick={() => patchActiveDataframe((current) => ({ ...current, language, frames: current.frames.map((frame) => ({ ...frame, language })) }))}
                  >
                    {language}
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 font-semibold text-zinc-500 hover:bg-red-500 hover:text-white disabled:pointer-events-none disabled:opacity-40"
                    onClick={() => updateLanguages(activeDataframe.plotLanguages.filter((entry) => entry !== language))}
                    disabled={activeDataframe.plotLanguages.length <= 1}
                    aria-label={t('removeLanguage', { language })}
                    title={t('removeLanguage', { language })}
                  >
                    ×
                  </button>
                </span>
              )
            })}
          </div>
          <span className="flex items-center gap-2">
            <Input
              className="h-8 w-40"
              value={plotLanguageDraft}
              placeholder={t('languageCode')}
              aria-label={t('addLanguage')}
              onChange={(event) => setPlotLanguageDraft(event.target.value)}
              onKeyDown={handlePlotLanguageKeyDown}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => addPlotLanguage(plotLanguageDraft)}>{t('addLanguage')}</Button>
          </span>
        </div>
      </Field>

      <SettingsGroup title={t('plotGroup')} level="default">
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
          <Field label={t('DarkMode')} jsonPath="dataframes[i].dark_mode" level="default" changed={activeDataframe.darkMode !== DEFAULT_DATAFRAME.darkMode}>
            <Toggle checked={activeDataframe.darkMode} label={t('DarkMode')} onChange={(darkMode) => patchActiveDataframe((current) => ({ ...current, darkMode }))} />
          </Field>
        </div>
      </SettingsGroup>

      <SettingsGroup title={t('fontGroup')} level="default">
        <div className="grid gap-4 @lg:grid-cols-3">
          <Field label={t('fontStyle')} jsonPath="font.font_style" level="default" changed={font.fontStyle !== defaultFont.fontStyle}>
            <Select
              value={font.fontStyle}
              onChange={(event) => patchActiveDataframe((current) => ({ ...current, font: { ...current.font, fontStyle: event.target.value as DataframeConfig['font']['fontStyle'] } }))}
            >
              {FONT_STYLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
          </Field>
          <Field label={t('fontFamily')} jsonPath="font.font" level="default" changed={font.font !== defaultFont.font}>
            <Select
              value={isKnownFontFamily ? font.font : CUSTOM_SELECT_VALUE}
              onChange={(event) => patchActiveDataframe((current) => ({ ...current, font: { ...current.font, font: event.target.value === CUSTOM_SELECT_VALUE ? '' : event.target.value } }))}
            >
              {FONT_FAMILY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              <option disabled>──────────</option>
              <option value={CUSTOM_SELECT_VALUE}>{t('custom')}</option>
            </Select>
            {!isKnownFontFamily ? (
              <Input
                value={font.font}
                onChange={(event) => patchActiveDataframe((current) => ({ ...current, font: { ...current.font, font: event.target.value } }))}
                placeholder={t('customFontFamily')}
              />
            ) : null}
          </Field>
          {fontNumber('fontSize', t('fontSize'), 'font.font_size')}
        </div>
      </SettingsGroup>

      <SettingsGroup title={t('textSizes')} level="default">
        <div className="grid gap-4 @lg:grid-cols-3">
          {fontNumber('titleSize', t('titleSize'), 'font.title_size')}
          {fontNumber('legendTitleSize', t('legendTitleSize'), 'font.legend_title_size')}
          {fontNumber('legendLabelSize', t('legendLabelSize'), 'font.legend_label_size')}
          {fontNumber('axisLabelSize', t('axisLabelSize'), 'font.axis_label_size')}
          {fontNumber('tickSize', t('tickSize'), 'font.tick_size')}
        </div>
      </SettingsGroup>
    </>
  )
}
