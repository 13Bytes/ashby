import type { LabelKey } from '../uiTranslations'
import { createDefaultPlotConfig, type AnnotationConfig, type ColoredAreaConfig, type GuidelineConfig } from './defaultPlotConfig'

/** Settings sections in the order of the sidebar. Dataset sections are shared by all frames of a dataframe. */
export const SETTINGS_SECTIONS = [
  { id: 'data', scope: 'dataset', titleKey: 'secData', introKey: 'introData' },
  { id: 'textLook', scope: 'dataset', titleKey: 'secTextLook', introKey: 'introTextLook', allSettingsOnly: true },
  { id: 'axisDefs', scope: 'dataset', titleKey: 'secAxisDefs', introKey: 'introAxisDefs' },
  { id: 'materials', scope: 'dataset', titleKey: 'secMaterials', introKey: 'introMaterials' },
  { id: 'titleAxes', scope: 'plot', titleKey: 'secTitleAxes', introKey: 'introTitleAxes' },
  { id: 'hulls', scope: 'plot', titleKey: 'secHulls', introKey: 'introHulls' },
  { id: 'extras', scope: 'plot', titleKey: 'secExtras', introKey: 'introExtras' },
  { id: 'json', scope: 'plot', titleKey: 'secJson', introKey: 'introJson' },
] as const satisfies ReadonlyArray<{ id: string; scope: 'dataset' | 'plot'; titleKey: LabelKey; introKey: LabelKey; allSettingsOnly?: boolean }>

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']
export type SettingsMode = 'simple' | 'all'

export const isSettingsSectionId = (value: string): value is SettingsSectionId => SETTINGS_SECTIONS.some((section) => section.id === value)

/** Sections whose settings can all stay at their defaults; Simple mode hides them completely. */
export const isHiddenInMode = (id: SettingsSectionId, mode: SettingsMode): boolean =>
  mode === 'simple' && SETTINGS_SECTIONS.some((section) => section.id === id && 'allSettingsOnly' in section && section.allSettingsOnly)

// Defaults used to mark settings that were changed ("changed from the default" in the level icon).
const defaults = createDefaultPlotConfig()
export const DEFAULT_DATAFRAME = defaults.dataframes[0]
export const DEFAULT_FRAME = DEFAULT_DATAFRAME.frames[0]
export const DEFAULT_LAYER = DEFAULT_FRAME.layers[0]
export const DEFAULT_MARGIN = 0.12
export const DEFAULT_AREA: Pick<ColoredAreaConfig, 'alpha'> = { alpha: 0.2 }
export const DEFAULT_GUIDELINE: Pick<GuidelineConfig, 'lineProps' | 'fontsize' | 'labelAbove' | 'labelRotated' | 'labelPadding'> = {
  lineProps: { linestyle: '--', color: 'aqua', linewidth: 4 },
  fontsize: 18,
  labelAbove: true,
  labelRotated: true,
  labelPadding: 6,
}
export const DEFAULT_ANNOTATION_TEXT: NonNullable<AnnotationConfig['text']> = { name: '', relPos: [0, 0], color: '#111827' }
export const DEFAULT_ANNOTATION_MARKER: NonNullable<AnnotationConfig['marker']> = { color: 'default', markerSymbol: 'o', sizeFactor: 1, linewidths: 0, edgecolors: 'black' }
export const DEFAULT_ANNOTATION_ARROW: NonNullable<AnnotationConfig['arrow']> = { width: 1, facecolor: 'blue', headlength: 10, headwidth: 6, linewidth: 1 }
