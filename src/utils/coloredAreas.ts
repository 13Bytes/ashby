import type { ColoredAreaConfig, FrameConfig } from '../config/defaultPlotConfig'
import { plotAxesOf } from './configEditing'

/** A new area is a range on the axes (the only type in Simple mode); switching it to a polygon adds the first corner. */
export const addColoredAreaToFrame = (frame: FrameConfig): FrameConfig => ({
  ...frame,
  coloredAreas: [...frame.coloredAreas, { axes: {}, x: [], y: [], color: '#ef4444', alpha: 0.2 }],
})

/** Switches an area between axis ranges and a polygon; a polygon without corners gets one at the origin. */
export const setColoredAreaType = (area: ColoredAreaConfig, type: 'axes' | 'polygon', frame: FrameConfig): ColoredAreaConfig =>
  type === 'axes'
    ? { ...area, axes: area.axes ?? {} }
    : area.x.length > 0 || area.y.length > 0
      ? { ...area, axes: undefined }
      : { ...area, axes: undefined, x: [0], y: [0], plotAxes: plotAxesOf(frame) }
