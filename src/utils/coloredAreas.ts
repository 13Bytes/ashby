import type { FrameConfig } from '../config/defaultPlotConfig'

export const addColoredAreaToFrame = (frame: FrameConfig): FrameConfig => ({
  ...frame,
  coloredAreas: [...frame.coloredAreas, { x: [0, 1], y: [0, 1], color: '#ef4444', alpha: 0.2 }],
})
