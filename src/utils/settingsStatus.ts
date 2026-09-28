import type { DataframeConfig, FrameConfig } from '../config/defaultPlotConfig'
import type { SettingsSectionId } from '../config/settingsSections'
import type { LabelKey } from '../uiTranslations'
import { getSourceMode } from './appState'

/** A required setting that is not set; `setting` is the label key of the field to jump to. */
export type MissingSetting = { section: SettingsSectionId; setting: LabelKey }

/**
 * Required dataframe settings: a configured data source and axis definitions with a name and at
 * least one column. `sourceFileAvailable` tells whether an uploaded Excel file is in the browser.
 */
export function getDataframeMissing(dataframe: DataframeConfig, availableDatasets: string[], sourceFileAvailable: boolean): MissingSetting[] {
  const missing: MissingSetting[] = []
  const sourceMode = getSourceMode(dataframe, availableDatasets)
  const sourceSet = sourceMode === 'teable'
    ? Boolean(dataframe.teableUrl && dataframe.apiKey)
    : sourceMode === 'dataset'
      ? Boolean(dataframe.importFileName)
      : Boolean(dataframe.importFileName) && sourceFileAvailable
  if (!sourceSet) missing.push({ section: 'data', setting: 'dataSource' })
  if (dataframe.axes.length === 0 || dataframe.axes.some((axis) => !axis.name.trim() || axis.columns.length === 0)) {
    missing.push({ section: 'axisDefs', setting: 'axes' })
  }
  return missing
}

/** Required frame settings: x and y quantity and the column of the first layer. */
export function getFrameMissing(frame: FrameConfig): MissingSetting[] {
  const missing: MissingSetting[] = []
  if (!frame.xQuantity) missing.push({ section: 'titleAxes', setting: 'xAxis' })
  if (!frame.yQuantity) missing.push({ section: 'titleAxes', setting: 'yAxis' })
  if (!frame.layers[0]?.name?.trim()) missing.push({ section: 'hulls', setting: 'groupMaterialsBy' })
  return missing
}
