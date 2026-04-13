import type { DataframeConfig, PlotConfig } from '../config/defaultPlotConfig'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'

type SourceMode = 'teable' | 'file'

interface Props {
  plotConfig: PlotConfig
  activeDataframeIndex: number
  onPatchDataframe: (index: number, patch: (current: DataframeConfig) => DataframeConfig) => void
  onAddDataframe: () => void
}

const getSourceMode = (dataframe: DataframeConfig): SourceMode => {
  const extensionMode = dataframe._extensions.sourceMode
  if (extensionMode === 'teable' || extensionMode === 'file') {
    return extensionMode
  }

  return dataframe.teableUrl || dataframe.apiKey ? 'teable' : 'file'
}

export function DataSourceSection({
  plotConfig,
  activeDataframeIndex,
  onPatchDataframe,
  onAddDataframe,
}: Props) {
  const dataframe = plotConfig.dataframes[activeDataframeIndex]
  const sourceMode = getSourceMode(dataframe)

  const update = (patch: (current: DataframeConfig) => DataframeConfig) => {
    onPatchDataframe(activeDataframeIndex, patch)
  }

  return (
    <div className="grid gap-3 text-sm">
      <div className="grid gap-2">
        <label htmlFor="source-mode" className="font-medium text-zinc-900 dark:text-zinc-100">
          Source mode
        </label>
        <Select
          id="source-mode"
          value={sourceMode}
          onChange={(event) => {
            const mode = event.target.value as SourceMode
            update((current) => ({
              ...current,
              _extensions: {
                ...current._extensions,
                sourceMode: mode,
              },
            }))
          }}
        >
          <option value="teable">Teable API</option>
          <option value="file">File import</option>
        </Select>
        <small className="text-xs text-zinc-600 dark:text-zinc-400">
          Legacy semantics: use <code>API_Key</code> + <code>teable_url</code> for live Teable loading,
          or <code>import_file_name</code> + <code>import_sheet</code> for static file input.
        </small>
      </div>

      {sourceMode === 'teable' ? (
        <>
          <div className="grid gap-2">
            <label htmlFor="api-key" className="font-medium text-zinc-900 dark:text-zinc-100">
              API_Key
            </label>
            <Input
              id="api-key"
              type="text"
              value={dataframe.apiKey ?? ''}
              placeholder="tb_..."
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  apiKey: event.target.value || null,
                }))
              }
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="teable-url" className="font-medium text-zinc-900 dark:text-zinc-100">
              teable_url
            </label>
            <Input
              id="teable-url"
              type="url"
              value={dataframe.teableUrl ?? ''}
              placeholder="https://..."
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  teableUrl: event.target.value || null,
                }))
              }
            />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-2">
            <label htmlFor="import-file-name" className="font-medium text-zinc-900 dark:text-zinc-100">
              import_file_name
            </label>
            <Input
              id="import-file-name"
              type="text"
              value={dataframe.importFileName ?? ''}
              placeholder="materials.xlsx"
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  importFileName: event.target.value || null,
                }))
              }
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="import-sheet" className="font-medium text-zinc-900 dark:text-zinc-100">
              import_sheet
            </label>
            <Input
              id="import-sheet"
              type="number"
              min={0}
              step={1}
              value={dataframe.importSheet}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  importSheet: Number.isFinite(event.target.valueAsNumber)
                    ? event.target.valueAsNumber
                    : 0,
                }))
              }
            />
          </div>
        </>
      )}

      <small className="text-xs text-zinc-600 dark:text-zinc-400">
        Hidden mode values are preserved in memory, so toggling does not discard prior Teable/file settings.
      </small>

      <div className="grid gap-1">
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onAddDataframe}>
          Add dataframe
        </Button>
        <small className="text-xs text-zinc-600 dark:text-zinc-400">
          Optional multi-dataframe support for <code>create_all_dataframes</code>-style workflows.
        </small>
      </div>
    </div>
  )
}
