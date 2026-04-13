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
  apiKey?: string
  teableUrl?: string
  importFileName?: string
  importSheet: number
  imageRatio: number
  resolution: number | 'svg'
  legendTitle: Record<string, string>
  font: {
    fontStyle: string
    font: string
    fontSize: number
  }
  language: string
  darkMode: boolean
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
  darkMode: boolean
  legendAbove?: boolean
  language: string
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
  marker?: {
    color: string
    markerSymbol: string
    sizeFactor: number
    linewidths: number
    edgecolors: string
  }
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
        name: '',
        apiKey: '',
        teableUrl: '',
        importFileName: '',
        importSheet: 0,
        imageRatio: 16 / 9,
        resolution: 'svg',
        legendTitle: { en: '' },
        font: {
          fontStyle: 'sans-serif',
          font: 'Arial',
          fontSize: 22,
        },
        language: 'en',
        darkMode: false,
        createAllFrames: true,
        frames: [
          {
            name: '',
            legendFlag: true,
            title: { en: '' },
            darkMode: false,
            legendAbove: false,
            language: 'en',
            exportFileName: '',
            xQuantity: 'deftemp',
            xRelQuantity: '',
            logXFlag: false,
            xLim: undefined,
            yQuantity: 'Rm',
            yRelQuantity: '',
            logYFlag: false,
            yLim: undefined,
            automaticDisplayAreaMargin: 0.12,
            algorithm: 'cubic',
            layers: [
              {
                name: 'Material',
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
          {
            name: 'deftemp',
            columns: ['Deflection Temperature at 18 MPa 264 psi'],
            mode: 'default',
            labels: {
              de: 'Verformungstemperatur [°C] @ 1,8 MPa',
              en: 'Deflection Temperature $HDT$ [°C] @ 1.8 MPa',
            },
          },
          {
            name: 'Rm',
            columns: [
              'Tensile Strength Yield',
              'Tensile Strength Ultimate',
              'Tensile Strength at Break',
              'Tensile Strength',
            ],
            mode: 'max',
            labels: {
              de: 'Zugfestigkeit $R_m$ [MPa]',
              en: 'Tensile Strength $R_m$ [MPa]',
            },
          },
          {
            name: 'dens',
            columns: ['Density'],
            mode: 'default',
            labels: {
              de: 'Dichte $[\\frac{\\text{g}}{\\text{cm}^3}]$',
              en: 'Density $[\\frac{\\text{g}}{\\text{cm}^3}]$',
            },
          },
        ],
        materialColors: {
          default: '#000000',
          ABS: '#219DD3',
          PA12: '#7BBFD9',
          PEEK: '#D69D20',
          PLA: '#E3B768',
          PET: '#3BD420',
          PETG: '#85E064',
          PPSU: '#B52ED6',
          PPS: '#CE82E0',
        },
        _extensions: {},
      },
    ],
    _extensions: {},
  }
}
