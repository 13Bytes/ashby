import type { PlotConfig } from '../config/defaultPlotConfig'

const JSONC_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
const JSONC_LINE_COMMENT = /(^|[^:\\])\/\/.*$/gm

function stripJsonComments(text: string): string {
  return text
    .replace(JSONC_BLOCK_COMMENT, '')
    .replace(JSONC_LINE_COMMENT, (_match, prefix: string) => prefix)
}

export function toExternalConfig(config: PlotConfig): unknown {
  return {
    version: config.version,
    create_all_dataframes: config.createAllDataframes,
    dataframes: config.dataframes.map((dataframe) => ({
      name: dataframe.name ?? null,
      API_Key: dataframe.apiKey ?? null,
      teable_url: dataframe.teableUrl ?? null,
      import_file_name: dataframe.importFileName ?? null,
      import_sheet: dataframe.importSheet,
      image_ratio: dataframe.imageRatio,
      resolution: dataframe.resolution,
      legend_title: dataframe.legendTitle,
      font: {
        font_style: dataframe.font.fontStyle,
        font: dataframe.font.font,
        font_size: dataframe.font.fontSize,
      },
      language: dataframe.language,
      plot_languages: dataframe.plotLanguages,
      dark_mode: dataframe.darkMode,
      create_all_frames: dataframe.createAllFrames,
      frames: dataframe.frames.map((frame) => ({
        name: frame.name ?? null,
        legend_flag: frame.legendFlag,
        title: frame.title,
        dark_mode: frame.darkMode,
        legend_above: frame.legendAbove ?? false,
        language: frame.language,
        export_file_name: frame.exportFileName ?? null,
        x_quantity: frame.xQuantity,
        x_rel_quantity: frame.xRelQuantity ?? null,
        log_x_flag: frame.logXFlag,
        x_lim: frame.xLim ?? null,
        y_quantity: frame.yQuantity,
        y_rel_quantity: frame.yRelQuantity ?? null,
        log_y_flag: frame.logYFlag,
        y_lim: frame.yLim ?? null,
        automatic_Display_Area_margin: frame.automaticDisplayAreaMargin,
        algorithm: frame.algorithm,
        layers: frame.layers.map((layer) => {
          const normalizedName = layer.name?.trim()
          return {
            ...(normalizedName ? { name: normalizedName } : {}),
            whitelist_flag: layer.whitelistFlag ?? false,
            whitelist: layer.whitelist ?? null,
            alpha: layer.alpha ?? null,
            linewidth: layer.linewidth ?? 1.5,
            alpha_points: layer.alphaPoints ?? null,
            alpha_areas: layer.alphaAreas ?? null,
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
          label_padding: guideline.labelPadding,
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
        colored_areas: frame.coloredAreas,
        highlighted_hulls: frame.highlightedHulls,
      })),
      axes: dataframe.axes,
      material_colors: dataframe.materialColors,
    })),
  }
}

export function exportConfig(config: PlotConfig): void {
  const payload = JSON.stringify(toExternalConfig(config), null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = `ashby-config-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()

  URL.revokeObjectURL(url)
}

export function parseImportedConfig(text: string, stripComments = true): unknown {
  const source = stripComments ? stripJsonComments(text) : text
  return JSON.parse(source)
}
