import type { DataframeConfig, PlotConfig } from '../config/defaultPlotConfig'

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
    <div className="data-source-section">
      <div className="field-group">
        <label htmlFor="source-mode">Source mode</label>
        <select
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
        </select>
        <small>
          Legacy semantics: use <code>API_Key</code> + <code>teable_url</code> for live Teable loading,
          or <code>import_file_name</code> + <code>import_sheet</code> for static file input.
        </small>
      </div>

      {sourceMode === 'teable' ? (
        <>
          <div className="field-group">
            <label htmlFor="api-key">API_Key</label>
            <input
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
          <div className="field-group">
            <label htmlFor="teable-url">teable_url</label>
            <input
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
          <div className="field-group">
            <label htmlFor="import-file-name">import_file_name</label>
            <input
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
          <div className="field-group">
            <label htmlFor="import-sheet">import_sheet</label>
            <input
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

      <small>
        Hidden mode values are preserved in memory, so toggling does not discard prior Teable/file settings.
      </small>

      <div>
        <button type="button" onClick={onAddDataframe}>
          Add dataframe
        </button>
        <small>
          Optional multi-dataframe support for <code>create_all_dataframes</code>-style workflows.
        </small>
      </div>
    </div>
  )
}
