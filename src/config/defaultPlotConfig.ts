export const PLOT_ALGORITHMS = ['cubic', 'alpha'] as const
export type PlotAlgorithm = (typeof PLOT_ALGORITHMS)[number]

export const AXIS_MODES = ['default', 'max', 'min', 'span'] as const
export type AxisMode = (typeof AXIS_MODES)[number]

export const LOG_FLAGS = [true, false] as const

export type UnknownConfigBucket = Record<string, unknown>

export interface PlotConfig {
  version: number
  createAllDataframes: true | number[]
  dataframes: DataframeConfig[]
  _extensions: UnknownConfigBucket
}

export interface DataframeConfig {
  name?: string
  excelImport:boolean
  apiKey?: string
  teableUrl?: string
  importFileName?: string
  importSheet?: number
  aspectRatio: number
  resolution: number | "svg"
  legendTitle: Record<string, string>
  font: {
    fontStyle: "serif" | "sans-serif" | "cursive" | "fantasy" | "monospace"
    font: string
    fontSize: number
    tickSize : number
    titleSize: number
    axisLabelSize: number
  }
  language: string
  plotLanguages: string[]
  darkMode: boolean
  createAllFrames: true | number[]
  frames: FrameConfig[]
  axes: AxisConfig[]
  materialColors: Record<string, string>
  _extensions: UnknownConfigBucket
}

export interface FrameConfig {
  name?: string
  title: Record<string, string>
  darkMode: boolean
  legendAbove: boolean|null
  exportFileName?: string
  xQuantity: string
  xRelQuantity?: string
  logXFlag: boolean
  xLim?: [number, number]
  yQuantity: string
  yRelQuantity?: string
  logYFlag: boolean
  yLim?: [number, number]
  automaticDisplayAreaMargin: number
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
  label: string
  labelAbove: boolean
  labelPadding: number
}

export interface AnnotationConfig {
  markerSize?: number
  fontSize?: number
  text?: {
    name: string
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
  axes?: Record<string, [number, number][]>
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
    version: 3,
    createAllDataframes: true,
    dataframes: [
      {
        excelImport: false,
        importSheet: 0,
        aspectRatio: 16 / 9,
        resolution: 'svg',
        legendTitle: { en: '' },
        font: {
          fontStyle: 'sans-serif',
          font: 'Arial',
          fontSize: 22,
          tickSize :0,
          titleSize:0,
          axisLabelSize:0,
        },
        language: 'en',
        plotLanguages: ['en'],
        darkMode: false,
        createAllFrames: true,
        frames: [
          {
            title: { en: '' },
            darkMode: false,
            legendAbove: false,
            xQuantity: undefined,
            logXFlag: false,
            xLim: [undefined, undefined],
            yQuantity: undefined,
            logYFlag: false,
            yLim: [undefined, undefined],
            automaticDisplayAreaMargin: 0.12,
            algorithm: 'cubic',
            layers: [
              {
                name: undefined,
                whitelistFlag: false,
                whitelist: [],
                alpha: 0.4,
                linewidth: 1.5,
              },
              {
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
