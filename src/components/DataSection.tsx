import type { ChangeEvent, RefObject } from 'react'
import type { DataframeConfig } from '../config/defaultPlotConfig'
import { useI18n } from '../uiTranslations'
import { getSourceMode, numberValue, type SourceMode } from '../utils/appState'
import { describeFormatWarning, type ExcelFormatWarning } from '../utils/excelFormat'
import { Field, ScopeTag, Segmented } from './AppControls'
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
  /** Formatting problems the backend found in the imported sheet. */
  formatWarnings: ExcelFormatWarning[]
  sourceMissing: boolean
  onImportConfig: () => void
  onExportConfig: () => void
  onResetConfig: () => void
}

/** Config file actions (whole project) and the data source of the active dataframe. */
export function DataSection({
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
  formatWarnings,
  sourceMissing,
  onImportConfig,
  onExportConfig,
  onResetConfig,
}: Props) {
  const { t } = useI18n()
  const importStatus = importedDatabaseStatus[activeDataframeIndex]
  const sourceMode = getSourceMode(activeDataframe, availableDatasets)
  const plotCount = activeDataframe.frames.length
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

  const sheetField = (
    <Field label={t('importSheet')} jsonPath="import_sheet" level="default" changed={activeDataframe.importSheet !== 0} selfClassName="w-44">
      {availableSheets.length > 0 ? (
        <Select
          value={activeDataframe.importSheet}
          onChange={(event) => patchActiveDataframe((current) => ({ ...current, importSheet: Number(event.target.value) }))}
        >
          {availableSheets.map((sheet, index) => <option key={index} value={index}>{sheet}</option>)}
        </Select>
      ) : (
        <Input type="number" min={0} step={1} value={activeDataframe.importSheet} onChange={(event) => patchActiveDataframe((current) => ({ ...current, importSheet: Math.max(0, Math.round(numberValue(event.target.valueAsNumber, current.importSheet))) }))} />
      )}
    </Field>
  )

  return (
    <>
      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60" data-always>
        <div className="flex flex-wrap items-center gap-2">
          <ScopeTag scope="project">{t('scopeProject')}</ScopeTag>
          <strong className="text-sm">{t('configFile')}</strong>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('configFileHint')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onImportConfig}>{t('importConfig')}</Button>
          <Button type="button" variant="outline" size="sm" onClick={onExportConfig}>{t('exportConfig')}</Button>
          <Button type="button" variant="outline" size="sm" className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40" onClick={onResetConfig}>{t('resetConfig')}</Button>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-sky-300 p-4 dark:border-sky-900">
        <div className="flex flex-wrap items-center gap-2">
          <ScopeTag scope="dataset">{t('datasetLabel')}</ScopeTag>
          <strong className="text-sm">{t('dataSource')}</strong>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('usedByPlots', { count: plotCount })}</span>
        </div>

        <Field label={t('sourceMode')} jsonPath="_extensions.source_mode" level="required" missing={sourceMissing} anchor="dataSource">
          <Segmented<SourceMode>
            ariaLabel={t('sourceMode')}
            value={sourceMode}
            onChange={updateSourceMode}
            options={[
              { value: 'file', label: t('sourceModeFile') },
              { value: 'dataset', label: t('sourceModeDataset') },
              { value: 'teable', label: t('sourceModeTeable') },
            ]}
          />
        </Field>

        {/* Every source mode uses the same panel: badge, what to import, import button, status. */}
        <div className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start gap-3">
            <span className="mt-[2.1rem] w-16 shrink-0 rounded bg-zinc-600 py-1 text-center font-mono text-[10px] font-medium text-white">
              {sourceMode === 'file' ? 'XLSX' : sourceMode === 'dataset' ? 'DATASET' : 'TEABLE'}
            </span>
            <div className="grid min-w-48 flex-1 gap-3">
              {sourceMode === 'teable' ? (
                <>
                  <Field label={t('teableUrl')} jsonPath="teable_url" level="required" missing={!activeDataframe.teableUrl}>
                    <Input value={activeDataframe.teableUrl ?? ''} placeholder={t('teableUrlPlaceholder')} onChange={(event) => patchActiveDataframe((current) => ({ ...current, teableUrl: event.target.value || undefined }))} />
                  </Field>
                  <Field label={t('apiKey')} jsonPath="API_Key" level="required" missing={!activeDataframe.apiKey}>
                    <Input type="password" autoComplete="off" value={activeDataframe.apiKey ?? ''} placeholder="teable_…" onChange={(event) => patchActiveDataframe((current) => ({ ...current, apiKey: event.target.value || undefined }))} />
                  </Field>
                </>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {sourceMode === 'dataset' ? (
                    <Field label={t('datasetName')} jsonPath="import_file_name" level="required" missing={!activeDataframe.importFileName} selfClassName="min-w-48 flex-1">
                      <Select
                        value={selectedDataset}
                        onChange={(event) => patchActiveDataframe((current) => ({ ...current, importFileName: event.target.value || undefined }))}
                        disabled={availableDatasets.length === 0}
                      >
                        {availableDatasets.length === 0 ? <option value="">{t('noDatasets')}</option> : null}
                        {availableDatasets.map((dataset) => <option key={dataset} value={dataset}>{dataset}</option>)}
                      </Select>
                    </Field>
                  ) : (
                    <Field label={t('excelFile')} jsonPath="import_file_name" level="required" missing={sourceMissing} selfClassName="min-w-48 flex-1">
                      <div className="flex h-9 items-center truncate rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                        {activeDataframe.importFileName ? <strong className="truncate">{activeDataframe.importFileName}</strong> : <span className="text-zinc-400">{t('noFileSelected')}</span>}
                      </div>
                      <input ref={uploadInputRef} type="file" accept=".xlsx" className="hidden" onChange={(event) => { void handleSpreadsheetSelection(event) }} />
                    </Field>
                  )}
                  {sourceMode === 'dataset' || activeDataframe.importFileName ? sheetField : null}
                </div>
              )}
            </div>
            <Button
              type="button"
              className="shrink-0 self-end"
              data-always
              disabled={importInProgress || (sourceMode === 'dataset' && !activeDataframe.importFileName)}
              onClick={() => (sourceMode === 'file' ? uploadInputRef.current?.click() : void importDatabase())}
            >
              {importInProgress ? t('importing') : sourceMode === 'file' ? t('uploadAndImport') : t('importDatabase')}
            </Button>
          </div>
          <p className="m-0 text-xs text-zinc-600 @lg:pl-[4.75rem] dark:text-zinc-300">
            {t('importStatus')}{' '}
            <strong className={importInProgress ? 'text-blue-600 dark:text-blue-400' : importStatus?.imported ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
              {importInProgress ? t('importing') : importStatus?.imported ? t('importedFrom', { source: importStatus.source }) : t('notImported')}
            </strong>
          </p>
          {formatWarnings.length > 0 && sourceMode !== 'teable' ? (
            <div role="status" className="grid gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 @lg:ml-[4.75rem] dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <strong>{t('formatWarningsTitle')}</strong>
              <ul className="m-0 grid list-disc gap-0.5 pl-4">
                {formatWarnings.map((warning, index) => <li key={index}>{describeFormatWarning(warning, t)}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
