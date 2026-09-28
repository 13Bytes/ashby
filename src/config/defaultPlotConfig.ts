export const PLOT_ALGORITHMS = ['cubic', 'alpha'] as const
export type PlotAlgorithm = (typeof PLOT_ALGORITHMS)[number]

export const AXIS_MODES = ['default', 'max', 'min', 'span'] as const
export type AxisMode = (typeof AXIS_MODES)[number]

export const FONT_STYLES = ['serif', 'sans-serif', 'cursive', 'fantasy', 'monospace'] as const

/**
 * Config format version this app reads and writes. Raise it together with CURRENT_VERSION in
 * backend/import_data/import_json.py (a frontend test checks that both match) when the format
 * changes. Importing a config of another version shows a warning.
 */
export const CONFIG_VERSION = 5

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
  transparent: boolean
  watermark: boolean|string
  copyright: boolean|string
  createAllFrames: true | number[]
  frames: FrameConfig[]
  axes: AxisConfig[]
  materialColors: Record<string, string>
  _extensions: UnknownConfigBucket
}

export interface FrameConfig {
  name?: string
  legendFlag: boolean
  title: Record<string, string>
  /** Overrides the dataframe's dark mode for this frame. */
  darkMode?: boolean
  /** Legend above the plot (true), to its right (false) or no legend (null). */
  legendAbove: boolean | null
  language: string
  xQuantity?: string
  xRelQuantity?: string
  logXFlag: boolean
  xLim?: [number | undefined, number | undefined]
  yQuantity?: string
  yRelQuantity?: string
  logYFlag: boolean
  yLim?: [number | undefined, number | undefined]
  automaticDisplayAreaMargin: { left: number; right: number; top: number; bottom: number } | null
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
        transparent: false,
        watermark: true,
        copyright: true,
        createAllFrames: true,
        frames: [
          {
            title: { en: '' },
            legendFlag: true,
            legendAbove: false,
            language: 'en',
            xQuantity: undefined,
            logXFlag: false,
            xLim: [undefined, undefined],
            yQuantity: undefined,
            logYFlag: false,
            yLim: [undefined, undefined],
            automaticDisplayAreaMargin: { left: 0.12, right: 0.12, top: 0.12, bottom: 0.12 },
            algorithm: 'cubic',
            layers: [
              {
                name: undefined,
                whitelistFlag: false,
                whitelist: [],
                alpha: 0.4,
                linewidth: 1.5,
                alphaPoints: undefined,
                alphaAreas: undefined,
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
