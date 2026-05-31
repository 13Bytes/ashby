import type { FrameConfig } from '../config/defaultPlotConfig'

export const parseNumberList = (value: string): number[] =>
  value
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry))

export const toCommaList = (values: number[] | undefined): string => (values ?? []).join(', ')

export const addColoredAreaToFrame = (frame: FrameConfig): FrameConfig => ({
  ...frame,
  coloredAreas: [...frame.coloredAreas, { x: [0, 1], y: [0, 1], color: '#ef4444', alpha: 0.2 }],
})
