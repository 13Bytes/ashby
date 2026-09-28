import {
  AXIS_MODES,
  CONFIG_VERSION,
  FONT_STYLES,
  PLOT_ALGORITHMS,
  type DataframeConfig,
  type FrameConfig,
  type PlotConfig,
  createDefaultPlotConfig,
} from './defaultPlotConfig'
import { ensureUiKeys } from '../utils/appState'
import { DEFAULT_ANNOTATION_SETTINGS } from '../utils/configEditing'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const asOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined
  }
  return typeof value === 'string' ? value : undefined
}

const coerceBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const coerceOptionalBool = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined

const coerceNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const coerceOptionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const coerceBoolOrString = (value: unknown, fallback: boolean | string): boolean | string =>
  typeof value === 'boolean' || typeof value === 'string' ? value : fallback

const coerceStringRecord = (value: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))

// The backend derives the file format from `resolution`: null or "svg" means SVG, a number means PNG at that DPI.
const coerceFileFormat = (fileformat: unknown, resolution: unknown, fallback: DataframeConfig['fileformat']): DataframeConfig['fileformat'] => {
  if (fileformat === 'svg' || fileformat === 'png') return fileformat
  if (resolution === 'svg' || resolution === null) return 'svg'
  if (typeof resolution === 'number' && Number.isFinite(resolution)) return 'png'
  return fallback
}

const coerceFontStyle = (
  value: unknown,
  fallback: DataframeConfig['font']['fontStyle'],
): DataframeConfig['font']['fontStyle'] =>
  typeof value === 'string' && FONT_STYLES.includes(value as DataframeConfig['font']['fontStyle'])
    ? (value as DataframeConfig['font']['fontStyle'])
    : fallback

const coerceNumberPair = (
  value: unknown,
  fallback: [number, number],
): [number, number] => {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item): item is number => typeof item === 'number' && Number.isFinite(item))
  ) {
    return [value[0], value[1]]
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return [value, 1]
  }

  return fallback
}

const coerceOptionalNumberPair = (
  value: unknown,
): [number | undefined, number | undefined] | undefined => {
  if (!Array.isArray(value) || value.length !== 2) {
    return undefined
  }

  const normalized = value.map((item) =>
    typeof item === 'number' && Number.isFinite(item) ? item : undefined,
  ) as [number | undefined, number | undefined]

  return normalized[0] === undefined && normalized[1] === undefined ? undefined : normalized
}

const normalizeLayers = (value: unknown, fallback: FrameConfig['layers']): FrameConfig['layers'] =>
  Array.isArray(value) && value.length > 0
    ? value.filter(isRecord).map((layer) => ({
      name: asOptionalString(layer.name),
      whitelistFlag: coerceBool(layer.whitelistFlag ?? layer.whitelist_flag, false),
      whitelist: Array.isArray(layer.whitelist)
        ? layer.whitelist.filter((entry): entry is string => typeof entry === 'string')
        : [],
      alpha: coerceOptionalNumber(layer.alpha),
      linewidth: coerceOptionalNumber(layer.linewidth),
      alphaPoints: coerceOptionalNumber(layer.alphaPoints ?? layer.alpha_points),
      alphaAreas: coerceOptionalNumber(layer.alphaAreas ?? layer.alpha_areas),
    }))
    : structuredClone(fallback)

const normalizeGuidelines = (value: unknown): FrameConfig['guidelines'] =>
  Array.isArray(value)
    ? value.filter(isRecord).map((guideline) => {
      const lineProps = isRecord(guideline.lineProps ?? guideline.line_props)
        ? (guideline.lineProps ?? guideline.line_props) as Record<string, unknown>
        : {}

      return {
        x: coerceOptionalNumber(guideline.x),
        y: coerceOptionalNumber(guideline.y),
        m: coerceNumber(guideline.m, 1),
        lineProps: {
          linestyle: typeof lineProps.linestyle === 'string' ? lineProps.linestyle : '--',
          color: typeof lineProps.color === 'string' ? lineProps.color : 'aqua',
          linewidth: coerceNumber(lineProps.linewidth, 4),
        },
        fontsize: coerceNumber(guideline.fontsize, 18),
        fontColor: typeof (guideline.fontColor ?? guideline.font_color) === 'string'
          ? String(guideline.fontColor ?? guideline.font_color)
          : '',
        label: typeof guideline.label === 'string'
          ? guideline.label
          : isRecord(guideline.label) ? coerceStringRecord(guideline.label) : '',
        labelAbove: coerceBool(guideline.labelAbove ?? guideline.label_above, true),
        labelRotated: coerceBool(guideline.labelRotated ?? guideline.label_rotated, true),
        labelPadding: coerceNumber(guideline.labelPadding ?? guideline.label_padding, 6),
      }
    })
    : []

const positiveOr = (value: number | undefined, fallback: number): number => (value !== undefined && value > 0 ? value : fallback)

/**
 * annotations[0] holds the default marker and font size of the frame's annotations. Older configs
 * leave them out (the backend then uses 330 and 18); fill them in so the fields show real values.
 */
const withAnnotationDefaults = (annotations: FrameConfig['annotations']): FrameConfig['annotations'] => {
  const [first = {}, ...rest] = annotations
  return [
    {
      ...first,
      markerSize: positiveOr(first.markerSize, DEFAULT_ANNOTATION_SETTINGS.markerSize!),
      fontSize: positiveOr(first.fontSize, DEFAULT_ANNOTATION_SETTINGS.fontSize!),
    },
    ...rest,
  ]
}

const normalizeAnnotations = (value: unknown, fallback: FrameConfig['annotations']): FrameConfig['annotations'] =>
  Array.isArray(value)
    ? value.filter(isRecord).map((annotation) => {
      const text = isRecord(annotation.text) ? annotation.text : undefined
      const marker = isRecord(annotation.marker) ? annotation.marker : undefined
      const arrow = isRecord(annotation.arrow) ? annotation.arrow : undefined

      return {
        markerSize: coerceOptionalNumber(annotation.markerSize ?? annotation.marker_size),
        fontSize: coerceOptionalNumber(annotation.fontSize ?? annotation.font_size),
        text: text
          ? {
            name: typeof text.name === 'string'
              ? text.name
              : isRecord(text.name) ? coerceStringRecord(text.name) : '',
            relPos: coerceNumberPair(text.relPos ?? text.rel_pos, [0, 0]),
            color: typeof text.color === 'string' ? text.color : '#111827',
            fontSize: coerceOptionalNumber(text.fontSize ?? text.font_size),
          }
          : undefined,
        axes: isRecord(annotation.axes)
          ? Object.fromEntries(
            Object.entries(annotation.axes).filter((entry): entry is [string, number] =>
              typeof entry[1] === 'number' && Number.isFinite(entry[1]),
            ),
          )
          : undefined,
        marker: marker
          ? {
            color: typeof marker.color === 'string' ? marker.color : 'default',
            markerSymbol: typeof (marker.markerSymbol ?? marker.marker_symbol) === 'string'
              ? String(marker.markerSymbol ?? marker.marker_symbol)
              : 'o',
            sizeFactor: coerceNumber(marker.sizeFactor ?? marker.size_factor, 1),
            linewidths: coerceNumber(marker.linewidths, 0),
            // The backend reads `edgecolors`; the config documentation calls it `edgecolor`.
            edgecolors: typeof (marker.edgecolors ?? marker.edgecolor) === 'string' ? String(marker.edgecolors ?? marker.edgecolor) : 'black',
          }
          : undefined,
        arrow: arrow
          ? {
            width: coerceNumber(arrow.width, 1),
            facecolor: typeof arrow.facecolor === 'string' ? arrow.facecolor : 'blue',
            headlength: coerceNumber(arrow.headlength, 10),
            headwidth: coerceNumber(arrow.headwidth, 6),
            linewidth: coerceNumber(arrow.linewidth, 1),
          }
          : undefined,
      }
    })
    : structuredClone(fallback)

type AreaRange = [number | null, number | null]

// Accepts [min, max] and the documented legacy form [[min, max]]; non-numbers become null (open).
const coerceAreaRange = (value: unknown): AreaRange | undefined => {
  const pair = Array.isArray(value) && value.length === 1 && Array.isArray(value[0]) ? value[0] : value
  if (!Array.isArray(pair) || pair.length !== 2) return undefined
  const bound = (entry: unknown) => (typeof entry === 'number' && Number.isFinite(entry) ? entry : null)
  return [bound(pair[0]), bound(pair[1])]
}

const normalizeAreaAxes = (value: unknown): Record<string, AreaRange> | undefined =>
  isRecord(value)
    ? Object.fromEntries(
      Object.entries(value)
        .map(([axis, range]) => [axis, coerceAreaRange(range)] as const)
        .filter((entry): entry is readonly [string, AreaRange] => entry[1] !== undefined),
    )
    : undefined

const normalizeColoredAreas = (value: unknown): FrameConfig['coloredAreas'] =>
  Array.isArray(value)
    ? value.filter(isRecord).map((area) => ({
      axes: normalizeAreaAxes(area.axes),
      x: Array.isArray(area.x) ? area.x.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry)) : [],
      y: Array.isArray(area.y) ? area.y.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry)) : [],
      color: typeof area.color === 'string' ? area.color : '#ef4444',
      alpha: coerceNumber(area.alpha, 0.2),
    }))
    : []

const normalizeFrame = (
  partial: unknown,
  fallback: FrameConfig,
): FrameConfig => {
  if (!isRecord(partial)) {
    return structuredClone(fallback)
  }

  const known = new Set([
    '_extensions',
    'name',
    'legend_flag',
    'legendFlag',
    'title',
    'dark_mode',
    'darkMode',
    'legend_above',
    'legendAbove',
    'language',
    'export_file_name',
    'exportFileName',
    'x_quantity',
    'xQuantity',
    'x_rel_quantity',
    'xRelQuantity',
    'log_x_flag',
    'logXFlag',
    'x_lim',
    'xLim',
    'y_quantity',
    'yQuantity',
    'y_rel_quantity',
    'yRelQuantity',
    'log_y_flag',
    'logYFlag',
    'y_lim',
    'yLim',
    'automatic_Display_Area_margin',
    'automaticDisplayAreaMargin',
    'algorithm',
    'layers',
    'filter',
    'guidelines',
    'annotations',
    'markers',
    'colored_areas',
    'coloredAreas',
    'highlighted_hulls',
    'highlightedHulls',
  ])

  const extensions = Object.fromEntries(
    Object.entries(partial).filter(([key]) => !known.has(key)),
  )
  if (isRecord(partial._extensions)) {
    Object.assign(extensions, partial._extensions)
  }

  const algorithm = partial.algorithm
  const normalizedAlgorithm: FrameConfig['algorithm'] =
    typeof algorithm === 'string' &&
      PLOT_ALGORITHMS.includes(algorithm as (typeof PLOT_ALGORITHMS)[number])
      ? (algorithm as FrameConfig['algorithm'])
      : fallback.algorithm

  const xLim = partial.xLim ?? partial.x_lim
  const yLim = partial.yLim ?? partial.y_lim

  const automaticDisplayAreaMarginSource = partial.automaticDisplayAreaMargin ?? partial.automatic_Display_Area_margin
  return {
    ...structuredClone(fallback),
    name: asOptionalString(partial.name),
    legendFlag: coerceBool(partial.legendFlag ?? partial.legend_flag, fallback.legendFlag),
    title: isRecord(partial.title)
      ? Object.fromEntries(
        Object.entries(partial.title).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      )
      : fallback.title,
    darkMode: coerceOptionalBool(partial.darkMode ?? partial.dark_mode),
    // null: no legend
    legendAbove: (partial.legendAbove ?? partial.legend_above) === null
      ? null
      : coerceBool(partial.legendAbove ?? partial.legend_above, fallback.legendAbove ?? false),
    language: typeof partial.language === 'string' ? partial.language : fallback.language,
    xQuantity:
      typeof (partial.xQuantity ?? partial.x_quantity) === 'string'
        ? String(partial.xQuantity ?? partial.x_quantity)
        : fallback.xQuantity,
    xRelQuantity: asOptionalString(partial.xRelQuantity ?? partial.x_rel_quantity),
    logXFlag: coerceBool(partial.logXFlag ?? partial.log_x_flag, fallback.logXFlag),
    xLim: coerceOptionalNumberPair(xLim),
    yQuantity:
      typeof (partial.yQuantity ?? partial.y_quantity) === 'string'
        ? String(partial.yQuantity ?? partial.y_quantity)
        : fallback.yQuantity,
    yRelQuantity: asOptionalString(partial.yRelQuantity ?? partial.y_rel_quantity),
    logYFlag: coerceBool(partial.logYFlag ?? partial.log_y_flag, fallback.logYFlag),
    yLim: coerceOptionalNumberPair(yLim),
    automaticDisplayAreaMargin: isRecord(automaticDisplayAreaMarginSource)
      ? {
        left: coerceNumber(automaticDisplayAreaMarginSource.left, fallback.automaticDisplayAreaMargin?.left ?? 0),
        right: coerceNumber(automaticDisplayAreaMarginSource.right, fallback.automaticDisplayAreaMargin?.right ?? 0),
        top: coerceNumber(automaticDisplayAreaMarginSource.top, fallback.automaticDisplayAreaMargin?.top ?? 0),
        bottom: coerceNumber(automaticDisplayAreaMarginSource.bottom, fallback.automaticDisplayAreaMargin?.bottom ?? 0),
      }
      : fallback.automaticDisplayAreaMargin,
    algorithm: normalizedAlgorithm,
    layers: normalizeLayers(partial.layers, fallback.layers),
    filter: isRecord(partial.filter) ? partial.filter : fallback.filter,
    guidelines: normalizeGuidelines(partial.guidelines),
    annotations: withAnnotationDefaults(Array.isArray(partial.annotations)
      ? normalizeAnnotations(partial.annotations, fallback.annotations)
      : Array.isArray(partial.markers)
        ? normalizeAnnotations(partial.markers, fallback.annotations)
        : fallback.annotations),
    coloredAreas: normalizeColoredAreas(partial.coloredAreas ?? partial.colored_areas),
    highlightedHulls: Array.isArray(partial.highlightedHulls ?? partial.highlighted_hulls)
      ? ((partial.highlightedHulls ?? partial.highlighted_hulls) as FrameConfig['highlightedHulls'])
      : fallback.highlightedHulls,
    _extensions: extensions,
  }
}

const normalizeDataframe = (
  partial: unknown,
  fallback: DataframeConfig,
): DataframeConfig => {
  if (!isRecord(partial)) {
    return structuredClone(fallback)
  }

  const legacyFrames = Array.isArray(partial.frames) ? partial.frames : null
  const normalizedFrames = legacyFrames
    ? legacyFrames.map((frame, index) =>
      normalizeFrame(frame, fallback.frames[index] ?? fallback.frames[0]),
    )
    : fallback.frames

  const known = new Set([
    '_extensions',
    'name',
    'API_Key',
    'apiKey',
    'teable_url',
    'teableUrl',
    'import_file_name',
    'importFileName',
    'excel_import',
    'excelImport',
    'import_sheet',
    'importSheet',
    'image_ratio',
    'aspectRatio',
    'image_width',
    'image_height',
    'fileformat',
    'resolution',
    'image_dpi',
    'transparent',
    'watermark',
    'copyright',
    'legend_title',
    'legendTitle',
    'font',
    'language',
    'plot_languages',
    'plotLanguages',
    'dark_mode',
    'darkMode',
    'create_all_frames',
    'createAllFrames',
    'frames',
    'axes',
    'material_colors',
    'materialColors',
  ])

  const extensions = Object.fromEntries(
    Object.entries(partial).filter(([key]) => !known.has(key)),
  )
  if (isRecord(partial._extensions)) {
    Object.assign(extensions, partial._extensions)
  }

  const legacyImageWidth = coerceNumber(partial.image_width, 0)
  const legacyImageHeight = coerceNumber(partial.image_height, 0)
  const createAllFramesSource = partial.createAllFrames ?? partial.create_all_frames
  const plotLanguagesSource = partial.plotLanguages ?? partial.plot_languages
  const importFileName = asOptionalString(partial.importFileName ?? partial.import_file_name)
  const apiKey = asOptionalString(partial.apiKey ?? partial.API_Key)
  const teableUrl = asOptionalString(partial.teableUrl ?? partial.teable_url)
  const excelImportFallback = importFileName ? true : apiKey || teableUrl ? false : fallback.excelImport

  return {
    ...structuredClone(fallback),
    name: asOptionalString(partial.name),
    excelImport: coerceBool(partial.excelImport ?? partial.excel_import, excelImportFallback),
    apiKey,
    teableUrl,
    importFileName,
    importSheet: Math.max(0, Math.round(coerceNumber(partial.importSheet ?? partial.import_sheet, fallback.importSheet))),
    aspectRatio:
      legacyImageWidth > 0 && legacyImageHeight > 0
        ? [legacyImageWidth, legacyImageHeight]
        : coerceNumberPair(partial.aspectRatio ?? partial.image_ratio, fallback.aspectRatio),
    fileformat: coerceFileFormat(partial.fileformat, partial.resolution, fallback.fileformat),
    resolution: coerceNumber(partial.resolution, fallback.resolution),
    legendTitle: isRecord(partial.legendTitle ?? partial.legend_title)
      ? Object.fromEntries(
        Object.entries((partial.legendTitle ?? partial.legend_title) as Record<string, unknown>).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
      : fallback.legendTitle,
    font: isRecord(partial.font)
      ? {
        fontStyle: coerceFontStyle(partial.font.fontStyle ?? partial.font.font_style, fallback.font.fontStyle),
        font: typeof partial.font.font === 'string' ? partial.font.font : fallback.font.font,
        fontSize:        coerceNumber(partial.font.fontSize ?? partial.font.font_size, fallback.font.fontSize),
        titleSize:       coerceNumber(partial.font.titleSize ?? partial.font.title_size, fallback.font.titleSize),
        legendTitleSize: coerceNumber(partial.font.legendTitleSize ?? partial.font.legend_title_size, fallback.font.legendTitleSize),
        legendLabelSize: coerceNumber(partial.font.legendLabelSize ?? partial.font.legend_label_size, fallback.font.legendLabelSize),
        axisLabelSize:   coerceNumber(partial.font.axisLabelSize ?? partial.font.axis_label_size, fallback.font.axisLabelSize),
        tickSize:        coerceNumber(partial.font.tickSize ?? partial.font.tick_size, fallback.font.tickSize),
      }
      : fallback.font,
    language: typeof partial.language === 'string' ? partial.language : fallback.language,
    plotLanguages: Array.isArray(plotLanguagesSource)
      ? plotLanguagesSource.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      : fallback.plotLanguages,
    darkMode: coerceBool(partial.darkMode ?? partial.dark_mode, fallback.darkMode),
    transparent: coerceBool(partial.transparent, fallback.transparent),
    watermark: coerceBoolOrString(partial.watermark, fallback.watermark),
    copyright: coerceBoolOrString(partial.copyright, fallback.copyright),
    createAllFrames:
      createAllFramesSource === true
        ? true
        : Array.isArray(createAllFramesSource)
          ? createAllFramesSource.filter(
            (entry): entry is number => typeof entry === 'number',
          )
          : fallback.createAllFrames,
    frames: normalizedFrames,
    axes: Array.isArray(partial.axes)
      ? partial.axes
        .filter(isRecord)
        .map((axis) => ({
          name: typeof axis.name === 'string' ? axis.name : '',
          columns: Array.isArray(axis.columns) ? axis.columns.filter((entry): entry is string => typeof entry === 'string') : [],
          mode:
            typeof axis.mode === 'string' && AXIS_MODES.includes(axis.mode as (typeof AXIS_MODES)[number])
              ? (axis.mode as DataframeConfig['axes'][number]['mode'])
              : 'default',
          labels: isRecord(axis.labels)
            ? Object.fromEntries(
              Object.entries(axis.labels).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
            )
            : {
              ...(typeof axis.de === 'string' ? { de: axis.de } : {}),
              ...(typeof axis.en === 'string' ? { en: axis.en } : {}),
            },
        }))
      : fallback.axes,
    materialColors: isRecord(partial.materialColors ?? partial.material_colors)
      ? Object.fromEntries(
        Object.entries((partial.materialColors ?? partial.material_colors) as Record<string, unknown>).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
      : fallback.materialColors,
    _extensions: extensions,
  }
}

/** The `version` of an imported config, or undefined if it has none (a number) at the top level. */
export const getConfigVersion = (input: unknown): number | undefined =>
  isRecord(input) ? coerceOptionalNumber(input.version) : undefined

/**
 * Converts any supported config shape into the editor model. Without input it returns the default
 * config. The model is always in the current format, so its version is CONFIG_VERSION.
 */
export function normalizePlotConfig(input?: unknown): PlotConfig {
  const fallback = createDefaultPlotConfig()

  if (!isRecord(input)) {
    return ensureUiKeys(fallback)
  }

  const rootSource = Array.isArray(input.dataframes) ? input : { ...input, dataframes: [input] }

  const known = new Set(['_extensions', 'version', 'create_all_dataframes', 'createAllDataframes', 'dataframes'])
  const extensions = Object.fromEntries(
    Object.entries(input).filter(([key]) => !known.has(key)),
  )
  if (isRecord(input._extensions)) {
    Object.assign(extensions, input._extensions)
  }

  const dataframes = Array.isArray(rootSource.dataframes)
    ? rootSource.dataframes.map((entry, index) =>
      normalizeDataframe(entry, fallback.dataframes[index] ?? fallback.dataframes[0]),
    )
    : fallback.dataframes

  const createAllDataframesSource =
    input.createAllDataframes ?? input.create_all_dataframes

  return ensureUiKeys({
    ...fallback,
    version: CONFIG_VERSION,
    createAllDataframes:
      createAllDataframesSource === true
        ? true
        : Array.isArray(createAllDataframesSource)
          ? createAllDataframesSource.filter(
            (entry): entry is number => typeof entry === 'number',
          )
          : fallback.createAllDataframes,
    dataframes,
    _extensions: extensions,
  })
}
