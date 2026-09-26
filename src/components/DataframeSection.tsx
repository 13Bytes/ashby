import type { ChangeEvent, KeyboardEvent, RefObject } from 'react'
import type { DataframeConfig } from '../config/defaultPlotConfig'
import { useI18n } from '../uiTranslations'
import { CUSTOM_SELECT_VALUE, FONT_FAMILY_OPTIONS, FONT_STYLE_OPTIONS } from '../config/uiOptions'
import { getSourceMode, numberValue, type SourceMode } from '../utils/appState'
import { Field, SectionHeading } from './AppControls'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'

type Props = {
  activeDataframe: DataframeConfig
  patchActiveDataframe: (patch: (current: DataframeConfig) => DataframeConfig) => void
  importInProgress: boolean
  importDatabase: () => Promise<void>
  uploadInputRef: RefObject<HTMLInputElement | null>
  handleSpreadsheetSelection: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  importedDatabaseStatus: Record<number, { imported: boolean; source: string }>
  activeDataframeIndex: number
  availableDatasets: string[]
  availableSheets: string[]
  plotLanguageDraft: string
  setPlotLanguageDraft: (value: string) => void
  handlePlotLanguageKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  addPlotLanguage: (language: string) => void
  updateLanguages: (next: string[]) => void
}

export function DataframeSection({
  activeDataframe,
  patchActiveDataframe,
  importInProgress,
  importDatabase,
  uploadInputRef,
  handleSpreadsheetSelection,
  importedDatabaseStatus,
  activeDataframeIndex,
  availableDatasets,
  availableSheets,
  plotLanguageDraft,
  setPlotLanguageDraft,
  handlePlotLanguageKeyDown,
  addPlotLanguage,
  updateLanguages,
}: Props) {
  const { t } = useI18n()
  const importStatus = importedDatabaseStatus[activeDataframeIndex]
  const sourceMode = getSourceMode(activeDataframe, availableDatasets)
  const isKnownFontFamily = FONT_FAMILY_OPTIONS.includes(activeDataframe.font.font)
  const selectedDataset = activeDataframe.importFileName && availableDatasets.includes(activeDataframe.importFileName)
    ? activeDataframe.importFileName
    : availableDatasets[0] ?? ''

  const updateSourceMode = (nextSourceMode: SourceMode) => {
    patchActiveDataframe((current) => {
      const nextExtensions = { ...current._extensions, source_mode: nextSourceMode }
      if (nextSourceMode === 'dataset') {
        return {
          ...current,
          _extensions: nextExtensions,
          importFileName: current.importFileName && availableDatasets.includes(current.importFileName)
            ? current.importFileName
            : (availableDatasets[0] ?? current.importFileName),
        }
      }
      return { ...current, _extensions: nextExtensions }
    })
  }

  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
      <SectionHeading className="sm:col-span-2" title={t('globalDataframe')} />

      <Field label={t('aspectRatio')} jsonPath="dataframes[i].image_ratio" className="grid grid-cols-[1fr_auto] items-center gap-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Input
            type="number"
            step="0.01"
            value={activeDataframe.aspectRatio[0]}
            onChange={(event) => patchActiveDataframe((current) => ({
              ...current,
              aspectRatio: [numberValue(event.target.valueAsNumber, current.aspectRatio[0]), current.aspectRatio[1]],
            }))}
          />
          <span> / </span>
          <Input
            type="number"
            step="0.01"
            value={activeDataframe.aspectRatio[1]}
            onChange={(event) => patchActiveDataframe((current) => ({
              ...current,
              aspectRatio: [current.aspectRatio[0], numberValue(event.target.valueAsNumber, current.aspectRatio[1])],
            }))}
          />
        </div>
      </Field>

      <Field label={t('resolution')} jsonPath="dataframes[i].resolution" className='grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2'>    {/* & fix */}
        <Button type="button" variant="outline" onClick={() => patchActiveDataframe((current) => ({ ...current, fileformat: current.fileformat === 'svg' ? "png" : "svg"}))}>{activeDataframe.fileformat}</Button>
        {activeDataframe.fileformat === 'svg' ? null : (
          <Input
            type="number"
            min={1}
            value={activeDataframe.resolution}
            onChange={(event) => patchActiveDataframe((current) => ({ ...current, resolution: numberValue(event.target.valueAsNumber, current.resolution) }))}    /* & not on change but click somewhere else */
          />
        )}
      </Field>

      <div className="sm:col-span-2 grid gap-3 md:grid-cols-4">
        <Field label={t('DarkMode')} jsonPath="dataframes[i].dark_mode">
          <Button
            type="button"
            variant="outline"
            onClick={() => patchActiveDataframe((current) => ({ ...current, darkMode: !current.darkMode }))}
          >
            {activeDataframe.darkMode ? t('enabled') : t('disabled')}
          </Button>
        </Field>

        <Field label={t('transparent')} jsonPath="dataframes[i].transparent">
          <Button
            type="button"
            variant="outline"
            onClick={() => patchActiveDataframe((current) => ({ ...current, transparent: !current.transparent }))}
          >
            {activeDataframe.transparent ? t('enabled') : t('disabled')}
          </Button>
        </Field>

        <Field label={t('watermark')} jsonPath="dataframes[i].watermark">
          <Button
            type="button"
            variant="outline"
            onClick={() => patchActiveDataframe((current) => ({ ...current, watermark: !current.watermark }))}
          >
            {activeDataframe.watermark ? t('enabled') : t('disabled')}
          </Button>
        </Field>

        <Field label={t('copyright')} jsonPath="dataframes[i].copyright">
          <Button
            type="button"
            variant="outline"
            onClick={() => patchActiveDataframe((current) => ({ ...current, copyright: !current.copyright }))}
          >
            {activeDataframe.copyright ? t('enabled') : t('disabled')}
          </Button>
        </Field>

      </div>
      <div className="sm:col-span-2 grid gap-3 md:grid-cols-3">
        <Field label={t('fontStyle')} jsonPath="font.font_style">
          <Select
            value={activeDataframe.font.fontStyle}
            onChange={(event) => patchActiveDataframe((current) => ({
              ...current,
              font: { ...current.font, fontStyle: event.target.value as DataframeConfig['font']['fontStyle'] },
            }))}
          >
            {FONT_STYLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </Select>
        </Field>

        <Field label={t('fontFamily')} jsonPath="font.font">
          <div className="grid gap-2">
            <Select
              value={isKnownFontFamily ? activeDataframe.font.font : CUSTOM_SELECT_VALUE}
              onChange={(event) => patchActiveDataframe((current) => ({
                ...current,
                font: { ...current.font, font: event.target.value === CUSTOM_SELECT_VALUE ? '' : event.target.value },
              }))}
            >
              {FONT_FAMILY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              <option disabled>──────────</option>
              <option value={CUSTOM_SELECT_VALUE}>{t('custom')}</option>
            </Select>
            {!isKnownFontFamily ? (
              <Input
                value={activeDataframe.font.font}
                onChange={(event) => patchActiveDataframe((current) => ({ ...current, font: { ...current.font, font: event.target.value } }))}
                placeholder={t('customFontFamily')}
              />
            ) : null}
          </div>
        </Field>

        <Field label={t('fontSize')} jsonPath="font.font_size">
          <Input
            type="number"
            value={activeDataframe.font.fontSize}
            onChange={(event) => patchActiveDataframe((current) => ({
              ...current,
              font: { ...current.font, fontSize: numberValue(event.target.valueAsNumber, current.font.fontSize) },
            }))}
          />
        </Field>
      </div>

      <div className="sm:col-span-2 grid gap-3 md:grid-cols-5">
        <FontNumberField label={t('titleSize')}        path="font.title_size"        value={activeDataframe.font.titleSize}       onChange={(value) => patchActiveDataframe((current) => ({ ...current, font: { ...current.font, titleSize:       numberValue(value, current.font.titleSize      ) } }))} />
        <FontNumberField label={t('legendTitleSize')} path="font.legend_title_size" value={activeDataframe.font.legendTitleSize} onChange={(value) => patchActiveDataframe((current) => ({ ...current, font: { ...current.font, legendTitleSize: numberValue(value, current.font.legendTitleSize) } }))} />
        <FontNumberField label={t('legendLabelSize')}  path="font.legend_label_size" value={activeDataframe.font.legendLabelSize} onChange={(value) => patchActiveDataframe((current) => ({ ...current, font: { ...current.font, legendLabelSize: numberValue(value, current.font.legendLabelSize) } }))} />
        <FontNumberField label={t('axisLabelSize')}   path="font.axis_label_size"   value={activeDataframe.font.axisLabelSize}   onChange={(value) => patchActiveDataframe((current) => ({ ...current, font: { ...current.font, axisLabelSize:   numberValue(value, current.font.axisLabelSize  ) } }))} />
        <FontNumberField label={t('tickSize')}         path="font.tick_size"         value={activeDataframe.font.tickSize}        onChange={(value) => patchActiveDataframe((current) => ({ ...current, font: { ...current.font, tickSize:        numberValue(value, current.font.tickSize       ) } }))} />
      </div>

      <section className="sm:col-span-2 grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-6">
        <Field label={t('sourceMode')} jsonPath="_extensions.source_mode">
          <Select
            value={sourceMode}
            onChange={(event) => updateSourceMode(event.target.value as SourceMode)}
          >
            <option value="file">{t('sourceModeFile')}</option>
            <option value="dataset">{t('sourceModeDataset')}</option>
            <option value="teable">{t('sourceModeTeable')}</option>
          </Select>
        </Field>

        {sourceMode === 'teable' ? (
          <>
            <Field label={t('teableUrl')} jsonPath="teable_url" selfClassName="sm:col-span-2">
              <Input value={activeDataframe.teableUrl ?? ''} placeholder={t('teableUrlPlaceholder')} onChange={(event) => patchActiveDataframe((current) => ({ ...current, teableUrl: event.target.value || undefined }))} />
            </Field>
            <Field label={t('apiKey')} jsonPath="API_Key" selfClassName="sm:col-span-2">
              <Input type="password" autoComplete="off" value={activeDataframe.apiKey ?? ''} placeholder="teable_…" onChange={(event) => patchActiveDataframe((current) => ({ ...current, apiKey: event.target.value || undefined }))} />
            </Field>
            <Button type="button" onClick={() => { void importDatabase() }} disabled={importInProgress} className="self-end-safe">
              {importInProgress ? t('importing') : t('importDatabase')}
            </Button>
          </>
        ) : sourceMode === 'dataset' ? (
          <>
            <Field label={t('datasetName')} jsonPath="import_file_name" selfClassName="sm:col-span-4">
              <Select
                value={selectedDataset}
                onChange={(event) => patchActiveDataframe((current) => ({ ...current, importFileName: event.target.value || undefined }))}
                disabled={availableDatasets.length === 0}
              >
                {availableDatasets.length === 0 ? <option value="">{t('noDatasets')}</option> : null}
                {availableDatasets.map((dataset) => <option key={dataset} value={dataset}>{dataset}</option>)}
              </Select>
            </Field>
            <Field label={t('importSheet')} jsonPath="import_sheet">
              {availableSheets.length > 0 ? (
                <Select
                  value={activeDataframe.importSheet}
                  onChange={(event) => patchActiveDataframe((current) => ({ ...current, importSheet: Number(event.target.value) }))}
                >
                  {availableSheets.map((sheet, index) => <option key={index} value={index}>{sheet}</option>)}
                </Select>
              ) : (
                <Input type="number" value={activeDataframe.importSheet} onChange={(event) => patchActiveDataframe((current) => ({ ...current, importSheet: numberValue(event.target.valueAsNumber, current.importSheet) }))} />
              )}
            </Field>
          </>
        ) : (
          <>
            <Field label={t('uploadXlsx')} jsonPath="import_file_name" selfClassName="sm:col-span-3">
              <Input value={activeDataframe.importFileName ?? ''} readOnly placeholder={t('noFileSelected')} />
            </Field>
            <Button type="button" onClick={() => uploadInputRef.current?.click()} disabled={importInProgress} className="self-end-safe">
              {importInProgress ? t('importing') : t('uploadAndImport')}
            </Button>
            {activeDataframe.importFileName ? (
              <Field label={t('importSheet')} jsonPath="import_sheet">
                {availableSheets.length > 0 ? (
                  <Select
                    value={activeDataframe.importSheet}
                    onChange={(event) => patchActiveDataframe((current) => ({ ...current, importSheet: Number(event.target.value) }))}
                  >
                    {availableSheets.map((sheet, index) => <option key={index} value={index}>{sheet}</option>)}
                  </Select>
                ) : (
                  <Input type="number" value={activeDataframe.importSheet} onChange={(event) => patchActiveDataframe((current) => ({ ...current, importSheet: numberValue(event.target.valueAsNumber, current.importSheet) }))} />
                )}
              </Field>
            ) : null}
            <input ref={uploadInputRef} type="file" accept=".xlsx" className="hidden" onChange={(event) => { void handleSpreadsheetSelection(event) }} />
          </>
        )}

        <div className="sm:col-span-full">
          <p className="m-0 text-xs text-zinc-600 dark:text-zinc-300">
            {t('importStatus')}{' '}
            <strong className={importInProgress ? 'text-blue-600 dark:text-blue-400' : importStatus?.imported ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
              {importInProgress ? t('importing') : importStatus?.imported ? t('importedFrom', { source: importStatus.source }) : t('notImported')}
            </strong>
          </p>
        </div>
      </section>

      <Field label={t('plotLanguages')} jsonPath="dataframes[i].plot_languages">
        <div className="flex items-center gap-2">
          <Input
            value={plotLanguageDraft}
            placeholder={t('addLanguage')}
            onChange={(event) => setPlotLanguageDraft(event.target.value)}
            onKeyDown={handlePlotLanguageKeyDown}
          />
          <Button type="button" variant="outline" onClick={() => addPlotLanguage(plotLanguageDraft)}>{t('add')}</Button>
        </div>
      </Field>

      <div className="flex flex-wrap items-center gap-2 self-end-safe pb-1.5">
        {activeDataframe.plotLanguages.map((language) => (
          <span key={language} className="inline-flex items-center overflow-hidden rounded-full border border-zinc-300 text-xs">
            <button
              type="button"
              className={`px-3 py-1 ${activeDataframe.language === language ? 'bg-violet-600 text-white hover:bg-violet-500' : 'hover:bg-gray-300'}`}
              onClick={() => patchActiveDataframe((current) => ({ ...current, language }))}
            >
              {language}
            </button>
            <button
              type="button"
              className="px-2 py-1 font-semibold hover:bg-red-500"
              onClick={() => updateLanguages(activeDataframe.plotLanguages.filter((entry) => entry !== language))}
              aria-label={t('removeLanguage', { language })}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </section>
  )
}

function FontNumberField({
  label,
  path,
  value,
  onChange,
}: {
  label: string
  path: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <Field label={label} jsonPath={path}>
      <Input type="number" value={value} onChange={(event) => onChange(event.target.valueAsNumber)} />
    </Field>
  )
}
