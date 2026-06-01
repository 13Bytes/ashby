import {
  AXIS_MODES,
  FONT_STYLES,
  PLOT_ALGORITHMS,
  type DataframeConfig,
  type FrameConfig,
  type PlotConfig,
  createDefaultPlotConfig,
} from './defaultPlotConfig'

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

const normalizeFrame = (
  partial: unknown,
  fallback: FrameConfig,
): FrameConfig => {
  if (!isRecord(partial)) {
    return structuredClone(fallback)
  }

  const known = new Set([
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
    'colored_areas',
    'coloredAreas',
    'highlighted_hulls',
    'highlightedHulls',
  ])

  const extensions = Object.fromEntries(
    Object.entries(partial).filter(([key]) => !known.has(key)),
  )

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
    legendAbove: coerceBool(partial.legendAbove ?? partial.legend_above, fallback.legendAbove ?? false),
    language: typeof partial.language === 'string' ? partial.language : fallback.language,
    exportFileName: asOptionalString(partial.exportFileName ?? partial.export_file_name),
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
    yLim:
      Array.isArray(yLim) && yLim.length === 2 && yLim.every((item) => typeof item === 'number')
        ? [yLim[0], yLim[1]]
        : undefined,
    automaticDisplayAreaMargin: isRecord(automaticDisplayAreaMarginSource)
      ? {
        left: coerceNumber(automaticDisplayAreaMarginSource.left, fallback.automaticDisplayAreaMargin?.left ?? 0),
        right: coerceNumber(automaticDisplayAreaMarginSource.right, fallback.automaticDisplayAreaMargin?.right ?? 0),
        top: coerceNumber(automaticDisplayAreaMarginSource.top, fallback.automaticDisplayAreaMargin?.top ?? 0),
        bottom: coerceNumber(automaticDisplayAreaMarginSource.bottom, fallback.automaticDisplayAreaMargin?.bottom ?? 0),
      }
      : fallback.automaticDisplayAreaMargin,
    algorithm: normalizedAlgorithm,
    layers: Array.isArray(partial.layers) ? partial.layers : fallback.layers,
    filter: isRecord(partial.filter) ? partial.filter : fallback.filter,
    guidelines: Array.isArray(partial.guidelines) ? partial.guidelines : fallback.guidelines,
    annotations: Array.isArray(partial.annotations)
      ? partial.annotations
      : Array.isArray(partial.markers)
        ? partial.markers
        : fallback.annotations,
    coloredAreas: Array.isArray(partial.coloredAreas ?? partial.colored_areas)
      ? ((partial.coloredAreas ?? partial.colored_areas) as FrameConfig['coloredAreas'])
      : fallback.coloredAreas,
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

  const legacyFrames = isRecord(partial) && Array.isArray(partial.frames) ? partial.frames : null
  const normalizedFrames = legacyFrames
    ? legacyFrames.map((frame, index) =>
      normalizeFrame(frame, fallback.frames[index] ?? fallback.frames[0]),
    )
    : fallback.frames

  const known = new Set([
    'name',
    'API_Key',
    'apiKey',
    'teable_url',
    'teableUrl',
    'import_file_name',
    'importFileName',
    'import_sheet',
    'importSheet',
    'image_ratio',
    'aspectRatio',
    'image_width',
    'image_height',
    'resolution',
    'image_dpi',
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

  const legacyImageWidth = coerceNumber(partial.image_width, 0)
  const legacyImageHeight = coerceNumber(partial.image_height, 0)
  const createAllFramesSource = partial.createAllFrames ?? partial.create_all_frames
  const plotLanguagesSource = partial.plotLanguages ?? partial.plot_languages

  return {
    ...structuredClone(fallback),
    name: asOptionalString(partial.name),
    apiKey: asOptionalString(partial.apiKey ?? partial.API_Key),
    teableUrl: asOptionalString(partial.teableUrl ?? partial.teable_url),
    importFileName: asOptionalString(partial.importFileName ?? partial.import_file_name),
    importSheet: coerceNumber(partial.importSheet ?? partial.import_sheet, fallback.importSheet),
    aspectRatio:
      legacyImageWidth > 0 && legacyImageHeight > 0
        ? [legacyImageWidth, legacyImageHeight]
        : coerceNumberPair(partial.aspectRatio ?? partial.image_ratio, fallback.aspectRatio),
    resolution:
      typeof (partial.resolution ?? partial.image_dpi) === 'number' ||
        (partial.resolution ?? partial.image_dpi) === 'svg'
        ? ((partial.resolution ?? partial.image_dpi) as number | 'svg')
        : fallback.resolution,
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
        fontSize: coerceNumber(partial.font.fontSize ?? partial.font.font_size, fallback.font.fontSize),
        tickSize: coerceNumber(partial.font.tickSize ?? partial.font.tick_size, fallback.font.tickSize),
        titleSize: coerceNumber(partial.font.titleSize ?? partial.font.title_size, fallback.font.titleSize),
        axisLabelSize: coerceNumber(partial.font.axisLabelSize ?? partial.font.axis_label_size, fallback.font.axisLabelSize),
        legendSize: coerceNumber(partial.font.legendSize ?? partial.font.legend_size, fallback.font.legendSize),
      }
      : fallback.font,
    language: typeof partial.language === 'string' ? partial.language : fallback.language,
    plotLanguages: Array.isArray(plotLanguagesSource)
      ? plotLanguagesSource.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      : fallback.plotLanguages,
    darkMode: coerceBool(partial.darkMode ?? partial.dark_mode, fallback.darkMode),
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





export function normalizePlotConfig(input?: unknown): PlotConfig {
  const fallback = createDefaultPlotConfig()

  if (!isRecord(input)) {
    return fallback
  }

  const rootSource = Array.isArray(input.dataframes) ? input : { ...input, dataframes: [input] }

  const known = new Set(['version', 'create_all_dataframes', 'createAllDataframes', 'dataframes'])
  const extensions = Object.fromEntries(
    Object.entries(input).filter(([key]) => !known.has(key)),
  )

  const dataframes = Array.isArray(rootSource.dataframes)
    ? rootSource.dataframes.map((entry, index) =>
      normalizeDataframe(entry, fallback.dataframes[index] ?? fallback.dataframes[0]),
    )
    : fallback.dataframes

  const createAllDataframesSource =
    input.createAllDataframes ?? input.create_all_dataframes

  return {
    ...fallback,
    version: coerceNumber(input.version, fallback.version),
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
  }
}
