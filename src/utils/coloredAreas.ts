import type { FrameConfig } from '../config/defaultPlotConfig'

export const parseNumberList = (value: string): number[] =>
  value
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry))

/** Strict variant for editing: returns undefined while the text is not a complete number list. */
export const parseStrictNumberList = (value: string): number[] | undefined => {
  if (!value.trim()) return []
  const entries = value.split(',').map((entry) => entry.trim())
  if (entries.some((entry) => entry === '')) return undefined
  const numbers = entries.map(Number)
  return numbers.every(Number.isFinite) ? numbers : undefined
}

export const toCommaList = (values: number[] | undefined): string => (values ?? []).join(', ')

export const addColoredAreaToFrame = (frame: FrameConfig): FrameConfig => ({
  ...frame,
  coloredAreas: [...frame.coloredAreas, { x: [0, 1], y: [0, 1], color: '#ef4444', alpha: 0.2 }],
})
