import type { PlotConfig } from '../config/defaultPlotConfig'

const JSONC_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
const JSONC_LINE_COMMENT = /(^|[^:\\])\/\/.*$/gm

function stripJsonComments(text: string): string {
  return text
    .replace(JSONC_BLOCK_COMMENT, '')
    .replace(JSONC_LINE_COMMENT, (_match, prefix: string) => prefix)
}

export function exportConfig(config: PlotConfig): void {
  const payload = JSON.stringify(config, null, 2)
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
