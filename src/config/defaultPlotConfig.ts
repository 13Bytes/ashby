export const PLOT_ALGORITHMS = ['cubic', 'alpha'] as const
export type PlotAlgorithm = (typeof PLOT_ALGORITHMS)[number]

export const AXIS_MODES = ['default', 'max', 'min', 'span'] as const
export type AxisMode = (typeof AXIS_MODES)[number]

export const FONT_STYLES = ['serif', 'sans-serif', 'cursive', 'fantasy', 'monospace'] as const

/**
 * Config format version this app reads and writes. Raise it together with CURRENT_VERSION in
 * backend/import_data/import_json.py (a frontend test checks that both match) when the format
 * changes. Importing a config of another version shows a warning.
 *
 * 6: `legend_above` moved from the frames to the dataframe; the frames' `dark_mode` was removed.
 *    `automatic_Display_Area_margin` is now `axis_margin`; a side is a margin (share of the data
 *    range) or `{ "absolute": 5 }`, a fixed value on the axis, which replaces `x_lim`/`y_lim`.
 *    Guidelines, polygon areas and `axis_margin` note in `plot_axes` which plot axes their
 *    coordinates were entered for.
 */
export const CONFIG_VERSION = 6

export type UnknownConfigBucket = Record<string, unknown>

export interface PlotConfig {
  version: number
  createAllDataframes: true | number[]
  dataframes: DataframeConfig[]
  _extensions: UnknownConfigBucket
}

export interface DataframeConfig {
  name?: string
  excelImport: boolean
  apiKey?: string
  teableUrl?: string
  importFileName?: string
  importSheet: number
  aspectRatio: [number, number]
  fileformat: "svg" | "png"
  resolution: number
  legendTitle: Record<string, string>
  font: {
    fontStyle: "serif" | "sans-serif" | "cursive" | "fantasy" | "monospace"
    font: string
    fontSize: number
    titleSize: number
    legendTitleSize: number
    legendLabelSize: number
    axisLabelSize: number
    tickSize: number
  }
  language: string
  plotLanguages: string[]
  darkMode: boolean
  /** Legend above the plots (true), to their right (false) or no legend (null). Since version 6. */
  legendAbove: boolean | null
  transparent: boolean
  watermark: boolean|string
  copyright: boolean|string
  createAllFrames: true | number[]
  frames: FrameConfig[]
  axes: AxisConfig[]
  materialColors: Record<string, string>
  _extensions: UnknownConfigBucket
}

export const MARGIN_SIDES = ['left', 'right', 'bottom', 'top'] as const
export type MarginSide = (typeof MARGIN_SIDES)[number]
/**
 * The plot's x and y axis when coordinates were entered, each the quantity or "quantity/relative
 * quantity". The editor warns when the plot shows other axes now.
 */
export type PlotAxes = [string, string]
/** Visible range per side: a margin as share of the data range, or for a side in `absolute` a fixed value on the axis. */
export type AxisMargin = Record<MarginSide, number> & { absolute: MarginSide[]; plotAxes?: PlotAxes }

export interface FrameConfig {
  name?: string
  title: Record<string, string>
  language: string
  xQuantity?: string
  xRelQuantity?: string
  logXFlag: boolean
  yQuantity?: string
  yRelQuantity?: string
  logYFlag: boolean
  axisMargin: AxisMargin
  algorithm: PlotAlgorithm
  layers: LayerConfig[]
  filter?: Record<string, unknown>
  guidelines: GuidelineConfig[]
  annotations: AnnotationConfig[]
  coloredAreas: ColoredAreaConfig[]
  highlightedHulls: HighlightedHullConfig[]
  _extensions: UnknownConfigBucket
}

export interface LayerConfig {
  name?: string
  whitelistFlag?: boolean
  whitelist?: string[]
  alpha?: number
  linewidth?: number
  alphaPoints?: number
  alphaAreas?: number
}

export interface GuidelineConfig {
  x?: number
  y?: number
  m: number
  lineProps: {
    linestyle: string
    color: string
    linewidth: number
  }
  fontsize: number
  fontColor: string
  /** Plain string or per-language labels (see PLACEHOLDER_LABEL in the backend docs). */
  label: string | Record<string, string>
  labelAbove: boolean
  plotAxes?: PlotAxes
  /** Label along the line (true) or horizontal (false). */
  labelRotated: boolean
  labelPadding: number
}

export interface AnnotationConfig {
  markerSize?: number
  fontSize?: number
  text?: {
    /** Plain string or per-language labels (see PLACEHOLDER_LABEL in the backend docs). */
    name: string | Record<string, string>
    relPos: [number, number]
    color: string
    fontSize?: number
  }
  axes?: Record<string, number>
  marker_flag?: boolean
  marker?: {
    color: string
    markerSymbol: string
    sizeFactor: number
    linewidths: number
    edgecolors: string
  }
  arrow_flag?: boolean
  arrow?: {
    width: number
    facecolor: string
    headlength: number
    headwidth: number
    linewidth: number
  }
}

export interface ColoredAreaConfig {
  /** Axis ranges: axis name → [min, max]; null extends the area to the plot edge. Without `axes`, `x`/`y` are polygon corners. */
  axes?: Record<string, [number | null, number | null]>
  x: number[]
  y: number[]
  /** Axes the polygon corners were entered for. */
  plotAxes?: PlotAxes
  color: string
  alpha: number
}

export interface HighlightedHullConfig {
  layer: string
  label: string
  alpha: number
  color: string
}

export interface AxisConfig {
  name: string
  columns: string[]
  mode: AxisMode
  labels: Record<string, string>
}

export function createDefaultPlotConfig(): PlotConfig {
  return {
    version: CONFIG_VERSION,
    createAllDataframes: true,
    dataframes: [
      {
        excelImport: true,
        importSheet: 0,
        aspectRatio: [3, 2],
        fileformat: 'svg',
        resolution: 100,
        legendTitle: { en: '' },
        font: {
          fontStyle: 'sans-serif',
          font: 'Arial',
          fontSize: 22,
          titleSize: 40,
          legendTitleSize: 20,
          legendLabelSize: 20,
          axisLabelSize: 15,
          tickSize: 5,
        },
        language: 'en',
        plotLanguages: ['en'],
        darkMode: false,
        legendAbove: false,
        transparent: false,
        watermark: true,
        copyright: true,
        createAllFrames: true,
        frames: [
          {
            title: { en: '' },
            language: 'en',
            xQuantity: undefined,
            logXFlag: false,
            yQuantity: undefined,
            logYFlag: false,
            axisMargin: { left: 0.12, right: 0.12, top: 0.12, bottom: 0.12, absolute: [] },
            algorithm: 'cubic',
            layers: [
              {
                name: undefined,
                whitelistFlag: false,
                whitelist: [],
                alpha: 0.4,
                linewidth: 1.5,
                alphaPoints: 0.3,
                alphaAreas: 0.6,
              },
            ],
            filter: {},
            guidelines: [],
            annotations: [
              {
                markerSize: 330,
                fontSize: 18,
              },
            ],
            coloredAreas: [],
            highlightedHulls: [],
            _extensions: {},
          },
        ],
        axes: [
        ],
        materialColors: {
          default: '#000000',
        },
        _extensions: {},
      },
    ],
    _extensions: {},
  }
}
