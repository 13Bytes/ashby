export interface LocalizedText {
  [languageCode: string]: string
}

export interface FontConfig {
  font_style: string
  font: string
  font_size: number
}

export interface LayerStyleConfig {
  alpha_points: number | null
  alpha_areas: number | null
}

export interface LayerConfig {
  name: string
  whitelist_flag: boolean
  whitelist: string[] | null
  alpha: number | null
  linewidth: number
}

export interface GuidelineLineProps {
  linestyle: string
  color: string
  linewidth: number
}

export interface GuidelineConfig {
  x: number | null
  y: number | null
  m: number
  line_props: GuidelineLineProps
  fontsize: number
  font_color: string
  label: string
  label_above: boolean
  label_padding: number
}

export interface AnnotationDefaults {
  marker_size: number
  font_size: number
}

export interface AnnotationText {
  name: string
  rel_pos: [number, number]
  color: string
  font_size: number
}

export interface AnnotationAxes {
  [axisName: string]: number
}

export interface AnnotationMarker {
  color: string
  marker_symbol: string
  size_factor: number
  linewidths: number
  edgecolors: string
}

export interface AnnotationArrow {
  width: number
  facecolor: string
  headlength: number
  headwidth: number
  linewidth: number
}

export interface AnnotationConfig {
  text: AnnotationText
  axes: AnnotationAxes
  marker: AnnotationMarker | null
  arrow: AnnotationArrow | null
}

export interface ColoredAreaConfig {
  axes: Record<string, [number, number][]> | null
  x: number[]
  y: number[]
  color: string
  alpha: number
}

export interface HighlightedHullConfig {
  layer: string
  label: string
  alpha: number
  color: string
}

export interface FrameConfig {
  name: string | null
  legend_flag: boolean
  title: LocalizedText
  dark_mode: boolean
  legend_above: boolean | null
  language: string
  export_file_name: string | null
  x_quantity: string
  x_rel_quantity: string | null
  log_x_flag: boolean
  x_lim: [number, number] | null
  y_quantity: string
  y_rel_quantity: string | null
  log_y_flag: boolean
  y_lim: [number, number] | null
  automatic_Display_Area_margin: number
  algorithm: string
  layers: [LayerConfig, LayerStyleConfig]
  filter: Record<string, unknown>
  guidelines: GuidelineConfig[]
  annotations: [AnnotationDefaults, ...AnnotationConfig[]]
  colored_areas: ColoredAreaConfig[]
  highlighted_hulls: HighlightedHullConfig[]
}

export interface AxisConfig {
  name: string
  columns: string[]
  mode: string
  labels: LocalizedText
}

export interface MaterialColors {
  default: string
  [materialName: string]: string | null
}

export interface DataframeConfig {
  name: string | null
  API_Key: string | null
  teable_url: string | null
  import_file_name: string
  import_sheet: number
  image_ratio: number
  resolution: number | 'svg'
  legend_title: LocalizedText
  font: FontConfig
  language: string
  dark_mode: boolean
  create_all_frames: true | number[]
  frames: FrameConfig[]
  axes: AxisConfig[]
  material_colors: MaterialColors
}

export interface PlotConfig {
  version: number
  create_all_dataframes: true | number[]
  dataframes: DataframeConfig[]
}
