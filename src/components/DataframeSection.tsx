import type { ChangeEvent, KeyboardEvent, RefObject } from 'react'
import type { DataframeConfig } from '../config/defaultPlotConfig'
import type { UILanguage } from '../uiTranslations'
import type { FieldComponent } from '../types/componentProps'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'

type Props = {
  t: (key: string) => string
  uiLanguage: UILanguage
  activeDataframe: DataframeConfig
  patchActiveDataframe: (patch: (current: DataframeConfig) => DataframeConfig) => void
  numberValue: (value: number, fallback: number) => number
  FONT_STYLE_OPTIONS: Array<DataframeConfig['font']['fontStyle']>
  FONT_FAMILY_OPTIONS: string[]
  CUSTOM_SELECT_VALUE: string
  importInProgress: boolean
  importDatabase: () => Promise<void>
  uploadInputRef: RefObject<HTMLInputElement | null>
  handleSpreadsheetSelection: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  importedDatabaseStatus: Record<number, { imported: boolean; source: string }>
  activeDataframeIndex: number
  plotLanguageDraft: string
  setPlotLanguageDraft: (value: string) => void
  handlePlotLanguageKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  addPlotLanguage: (language: string) => void
  updateLanguages: (next: string[]) => void
  FieldComponent: FieldComponent
}

const clampResolution = (raw: string): number | 'svg' => {
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'svg') return 'svg'
  const numeric = Number(normalized === '' ? 0 : normalized)
  if (!Number.isFinite(numeric)) return 0
  return Math.min(999, Math.max(30, Math.round(numeric)))
}

export function DataframeSection({
  t,
  uiLanguage,
  activeDataframe,
  patchActiveDataframe,
  numberValue,
  FONT_STYLE_OPTIONS,
  FONT_FAMILY_OPTIONS,
  CUSTOM_SELECT_VALUE,
  importInProgress,
  importDatabase,
  uploadInputRef,
  handleSpreadsheetSelection,
  importedDatabaseStatus,
  activeDataframeIndex,
  plotLanguageDraft,
  setPlotLanguageDraft,
  handlePlotLanguageKeyDown,
  addPlotLanguage,
  updateLanguages,
  FieldComponent: Field,
}: Props) {
  const importStatus = importedDatabaseStatus[activeDataframeIndex]
  const isKnownFontFamily = FONT_FAMILY_OPTIONS.includes(activeDataframe.font.font)

  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
      <h3 className="sm:col-span-2 text-sm font-semibold">{t('globalDataframe')}</h3>

      <Field language={uiLanguage} label={t('aspectRatio')} jsonPath="dataframes[i].image_ratio" className="grid grid-cols-[1fr_auto] items-center gap-2">
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

      <Field language={uiLanguage} label={t('resolution')} jsonPath="dataframes[i].resolution">
        <Input
          value={String(activeDataframe.resolution)}
          onChange={(event) => patchActiveDataframe((current) => ({ ...current, resolution: clampResolution(event.target.value) }))}
        />
      </Field>

      <Field language={uiLanguage} label={t('dataframeDarkMode')} jsonPath="dataframes[i].dark_mode">
        <Button
          type="button"
          variant="outline"
          onClick={() => patchActiveDataframe((current) => ({ ...current, darkMode: !current.darkMode }))}
        >
          {activeDataframe.darkMode ? t('enabled') : t('disabled')}
        </Button>
      </Field>

      <div className="sm:col-span-2 grid gap-3 md:grid-cols-3">
        <Field language={uiLanguage} label={t('fontStyle')} jsonPath="font.font_style">
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

        <Field language={uiLanguage} label={t('fontFamily')} jsonPath="font.font">
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
              <option value={CUSTOM_SELECT_VALUE}>custom…</option>
            </Select>
            {!isKnownFontFamily ? (
              <Input
                value={activeDataframe.font.font}
                onChange={(event) => patchActiveDataframe((current) => ({ ...current, font: { ...current.font, font: event.target.value } }))}
                placeholder="custom font family"
              />
            ) : null}
          </div>
        </Field>

        <Field language={uiLanguage} label={t('fontSize')} jsonPath="font.font_size">
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

      <div className="sm:col-span-2 grid gap-3 md:grid-cols-4">
        <FontNumberField label="Tick size" path="font.tick_size" value={activeDataframe.font.tickSize} uiLanguage={uiLanguage} Field={Field} onChange={(value) => patchActiveDataframe((current) => ({ ...current, font: { ...current.font, tickSize: numberValue(value, current.font.tickSize) } }))} />
        <FontNumberField label="Title size" path="font.title_size" value={activeDataframe.font.titleSize} uiLanguage={uiLanguage} Field={Field} onChange={(value) => patchActiveDataframe((current) => ({ ...current, font: { ...current.font, titleSize: numberValue(value, current.font.titleSize) } }))} />
        <FontNumberField label="Axis label size" path="font.axis_label_size" value={activeDataframe.font.axisLabelSize} uiLanguage={uiLanguage} Field={Field} onChange={(value) => patchActiveDataframe((current) => ({ ...current, font: { ...current.font, axisLabelSize: numberValue(value, current.font.axisLabelSize) } }))} />
        <FontNumberField label="Legend size" path="font.legend_size" value={activeDataframe.font.legendSize} uiLanguage={uiLanguage} Field={Field} onChange={(value) => patchActiveDataframe((current) => ({ ...current, font: { ...current.font, legendSize: numberValue(value, current.font.legendSize) } }))} />
      </div>

      <section className="sm:col-span-2 grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-6">
        <Field language={uiLanguage} label={t('sourceMode')} jsonPath="_extensions.source_mode">
          <Select
            value={activeDataframe.excelImport === true ? 'file' : 'teable'}
            onChange={(event) => patchActiveDataframe((current) => ({ ...current, excelImport: event.target.value === 'file' }))}
          >
            <option value="file">Upload .xlsx</option>
            <option value="teable">Teable URL + API key</option>
          </Select>
        </Field>

        {activeDataframe.excelImport === false ? (
          <>
            <Field language={uiLanguage} label={t('teableUrl')} jsonPath="teable_url" selfClassName="sm:col-span-2">
              <Input value={activeDataframe.teableUrl ?? ''} onChange={(event) => patchActiveDataframe((current) => ({ ...current, teableUrl: event.target.value || undefined }))} />
            </Field>
            <Field language={uiLanguage} label={t('apiKey')} jsonPath="API_Key" selfClassName="sm:col-span-2">
              <Input value={activeDataframe.apiKey ?? ''} onChange={(event) => patchActiveDataframe((current) => ({ ...current, apiKey: event.target.value || undefined }))} />
            </Field>
            <Button type="button" onClick={() => { void importDatabase() }} disabled={importInProgress} className="self-end-safe">
              {importInProgress ? 'Importing…' : 'Import database'}
            </Button>
          </>
        ) : (
          <>
            <Field language={uiLanguage} label={t('uploadXlsx')} jsonPath="import_file_name" selfClassName="sm:col-span-3">
              <Input value={activeDataframe.importFileName ?? ''} readOnly placeholder="No file selected" />
            </Field>
            <Field language={uiLanguage} label={t('importSheet')} jsonPath="import_sheet">
              <Input type="number" value={activeDataframe.importSheet} onChange={(event) => patchActiveDataframe((current) => ({ ...current, importSheet: numberValue(event.target.valueAsNumber, current.importSheet) }))} />
            </Field>
            <Button type="button" onClick={() => uploadInputRef.current?.click()} disabled={importInProgress} className="self-end-safe">
              {importInProgress ? 'Importing…' : t('uploadAndImport')}
            </Button>
            <input ref={uploadInputRef} type="file" accept=".xlsx" className="hidden" onChange={(event) => { void handleSpreadsheetSelection(event) }} />
          </>
        )}

        <div className="sm:col-span-full">
          <p className="m-0 text-xs text-zinc-600 dark:text-zinc-300">
            Database import status:{' '}
            <strong className={importStatus?.imported ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
              {importStatus?.imported ? `Imported (${importStatus.source})` : 'Not imported'}
            </strong>
          </p>
        </div>
      </section>

      <Field language={uiLanguage} label={t('plotLanguages')} jsonPath="dataframes[i].plot_languages">
        <div className="flex items-center gap-2">
          <Input
            value={plotLanguageDraft}
            placeholder="Add language and press comma"
            onChange={(event) => setPlotLanguageDraft(event.target.value)}
            onKeyDown={handlePlotLanguageKeyDown}
          />
          <Button type="button" variant="outline" onClick={() => addPlotLanguage(plotLanguageDraft)}>{t('add')}</Button>
        </div>
      </Field>

      <div className="flex flex-wrap items-center gap-2 self-end-safe">
        {activeDataframe.plotLanguages.map((language) => (
          <span key={language} className="inline-flex items-center overflow-hidden rounded-full border border-zinc-300 text-xs">
            <button
              type="button"
              className={`px-3 py-1 ${activeDataframe.language === language ? 'bg-violet-400' : ''}`}
              onClick={() => patchActiveDataframe((current) => ({ ...current, language }))}
            >
              {language}
            </button>
            <button
              type="button"
              className="px-2 py-1 font-semibold hover:bg-red-500"
              onClick={() => updateLanguages(activeDataframe.plotLanguages.filter((entry) => entry !== language))}
              aria-label={`Remove ${language} language`}
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
  uiLanguage,
  Field,
  onChange,
}: {
  label: string
  path: string
  value: number
  uiLanguage: UILanguage
  Field: FieldComponent
  onChange: (value: number) => void
}) {
  return (
    <Field language={uiLanguage} label={label} jsonPath={path}>
      <Input type="number" value={value} onChange={(event) => onChange(event.target.valueAsNumber)} />
    </Field>
  )
}
