import { CONFIG_VERSION, MARGIN_SIDES, type AxisMargin, type PlotConfig } from '../config/defaultPlotConfig'

/** A margin is a number, a fixed value on the axis `{ absolute: v }`; `plot_axes` only matters for fixed values. */
const exportAxisMargin = (margin: AxisMargin) => ({
  ...Object.fromEntries(MARGIN_SIDES.map((side) => [side, margin.absolute.includes(side) ? { absolute: margin[side] } : margin[side]])),
  ...(margin.plotAxes && margin.absolute.length > 0 ? { plot_axes: margin.plotAxes } : {}),
})

/** Removes // and /* *\/ comments from JSONC while leaving string contents (e.g. URLs) untouched. */
export function stripJsonComments(text: string): string {
  let result = ''
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (char === '"') {
      const start = index
      index += 1
      while (index < text.length && text[index] !== '"') {
        index += text[index] === '\\' ? 2 : 1
      }
      index += 1
      result += text.slice(start, index)
    } else if (char === '/' && text[index + 1] === '/') {
      while (index < text.length && text[index] !== '\n') index += 1
    } else if (char === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2)
      index = end < 0 ? text.length : end + 2
    } else {
      result += char
      index += 1
    }
  }
  return result
}

/** Triggers a browser download for a blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  // Revoking synchronously can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function toExternalConfig(config: PlotConfig): unknown {
  return {
    // The editor model is always in the current format, also after importing an older config.
    version: CONFIG_VERSION,
    create_all_dataframes: config.createAllDataframes,
    _extensions: config._extensions,
    dataframes: config.dataframes.map((dataframe) => ({
      name: dataframe.name ?? null,
      API_Key: dataframe.apiKey ?? null,
      teable_url: dataframe.teableUrl ?? null,
      import_file_name: dataframe.importFileName ?? null,
      import_sheet: dataframe.importSheet,
      image_ratio: dataframe.aspectRatio,
      fileformat: dataframe.fileformat,
      // The backend picks SVG when resolution is "svg"/null and PNG when it is a number.
      resolution: dataframe.fileformat === 'svg' ? 'svg' : dataframe.resolution,
      legend_title: dataframe.legendTitle,
      font: {
        font_style: dataframe.font.fontStyle,
        font: dataframe.font.font,
        font_size: dataframe.font.fontSize,
        title_size: dataframe.font.titleSize,
        legend_title_size: dataframe.font.legendTitleSize,
        legend_label_size: dataframe.font.legendLabelSize,
        axis_label_size: dataframe.font.axisLabelSize,
        tick_size: dataframe.font.tickSize,
      },
      language: dataframe.language,
      plot_languages: dataframe.plotLanguages,
      dark_mode: dataframe.darkMode,
      legend_above: dataframe.legendAbove,
      transparent: dataframe.transparent,
      watermark: dataframe.watermark,
      copyright: dataframe.copyright,
      create_all_frames: dataframe.createAllFrames,
      _extensions: dataframe._extensions,
      frames: dataframe.frames.map((frame) => ({
        name: frame.name ?? null,
        title: frame.title,
        language: frame.language,
        x_quantity: frame.xQuantity,
        x_rel_quantity: frame.xRelQuantity ?? null,
        log_x_flag: frame.logXFlag,
        y_quantity: frame.yQuantity,
        y_rel_quantity: frame.yRelQuantity ?? null,
        log_y_flag: frame.logYFlag,
        axis_margin: exportAxisMargin(frame.axisMargin),
        algorithm: frame.algorithm,
        layers: frame.layers.map((layer) => {
          const normalizedName = layer.name?.trim()
          const hasPrimaryFields = Boolean(
            normalizedName
            || layer.whitelist !== undefined
            || layer.alpha !== undefined
            || layer.linewidth !== undefined
            || layer.whitelistFlag !== undefined,
          )

          if (!hasPrimaryFields) {
            return {
              alpha_points: layer.alphaPoints ?? null,
              alpha_areas: layer.alphaAreas ?? null,
            }
          }

          return {
            ...(normalizedName ? { name: normalizedName } : {}),
            whitelist_flag: layer.whitelistFlag ?? false,
            whitelist: layer.whitelist ?? null,
            alpha: layer.alpha ?? null,
            linewidth: layer.linewidth ?? 1.5,
            // The backend reads alpha_points/alpha_areas from the last layer, which may be a named one.
            ...(layer.alphaPoints !== undefined ? { alpha_points: layer.alphaPoints } : {}),
            ...(layer.alphaAreas !== undefined ? { alpha_areas: layer.alphaAreas } : {}),
          }
        }),
        filter: frame.filter ?? {},
        guidelines: frame.guidelines.map((guideline) => ({
          x: guideline.x ?? null,
          y: guideline.y ?? null,
          m: guideline.m,
          line_props: guideline.lineProps,
          fontsize: guideline.fontsize,
          font_color: guideline.fontColor,
          label: guideline.label,
          label_above: guideline.labelAbove,
          label_rotated: guideline.labelRotated,
          label_padding: guideline.labelPadding,
          ...(guideline.plotAxes ? { plot_axes: guideline.plotAxes } : {}),
        })),
        annotations: frame.annotations.map((annotation) => ({
          marker_size: annotation.markerSize,
          font_size: annotation.fontSize,
          text: annotation.text
            ? {
                name: annotation.text.name,
                rel_pos: annotation.text.relPos,
                color: annotation.text.color,
                font_size: annotation.text.fontSize,
              }
            : undefined,
          axes: annotation.axes,
          marker: annotation.marker
            ? {
                color: annotation.marker.color,
                marker_symbol: annotation.marker.markerSymbol,
                size_factor: annotation.marker.sizeFactor,
                linewidths: annotation.marker.linewidths,
                edgecolors: annotation.marker.edgecolors,
              }
            : undefined,
          arrow: annotation.arrow,
        })),
        colored_areas: frame.coloredAreas.map(({ plotAxes, ...area }) => ({ ...area, ...(plotAxes && !area.axes ? { plot_axes: plotAxes } : {}) })),
        highlighted_hulls: frame.highlightedHulls,
      })),
      axes: dataframe.axes,
      material_colors: dataframe.materialColors,
    })),
  }
}

export function exportConfig(config: PlotConfig, baseName?: string): void {
  const payload = JSON.stringify(toExternalConfig(config), null, 2)
  const name = baseName?.trim() || `ashby-config-${new Date().toISOString().slice(0, 10)}`
  downloadBlob(new Blob([payload], { type: 'application/json' }), `${name}.json`)
}

/**
 * Returns the offset of a frame object inside `JSON.stringify(toExternalConfig(config), null, 2)`,
 * so the JSON editor can jump to it. Everything before the frame is serialized identically when the
 * frame is swapped for a sentinel, which makes the sentinel's offset the frame's offset.
 */
export function findExternalFrameOffset(config: PlotConfig, dataframeIndex: number, frameIndex: number): number {
  const external = toExternalConfig(config) as { dataframes: Array<{ frames: unknown[] }> }
  const frames = external.dataframes[dataframeIndex]?.frames
  if (!frames || frameIndex >= frames.length) return -1
  const sentinel = '__ashby_frame_sentinel__'
  frames[frameIndex] = sentinel
  return JSON.stringify(external, null, 2).indexOf(`"${sentinel}"`)
}

/** Parses a JSON object/array typed into an editor field; empty text means `emptyValue`, invalid text undefined. */
export function parseJsonField<T>(text: string, emptyValue: T): T | undefined {
  if (!text.trim()) return emptyValue
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed !== null && typeof parsed === 'object' ? parsed as T : undefined
  } catch {
    return undefined
  }
}

export function parseImportedConfig(text: string, stripComments = true): unknown {
  const source = stripComments ? stripJsonComments(text) : text
  return JSON.parse(source)
}
