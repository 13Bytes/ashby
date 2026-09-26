import type { AnnotationConfig, AxisConfig, DataframeConfig, FrameConfig, GuidelineConfig } from '../config/defaultPlotConfig'

// Pure config transformations shared by the section components and usePlotConfigActions.
// Kept out of the component files so React fast refresh keeps working.

export const addAxisToDataframe = (df: DataframeConfig): DataframeConfig => ({
  ...df,
  axes: [
    ...df.axes,
    {
      name: `axis_${df.axes.length + 1}`,
      columns: [],
      mode: 'default',
      labels: df.plotLanguages.reduce<Record<string, string>>((acc, lang) => ({ ...acc, [lang]: '' }), {}),
    },
  ],
})

export const updateAxisInDataframe = (df: DataframeConfig, axisIndex: number, patch: (axis: AxisConfig) => AxisConfig): DataframeConfig => ({
  ...df,
  axes: df.axes.map((axis, index) => (index === axisIndex ? patch(axis) : axis)),
})

export const addLayerToFrame = (frame: FrameConfig): FrameConfig => ({
  ...frame,
  layers: [...frame.layers, { name: '', whitelist: [], alphaPoints: undefined, alphaAreas: undefined, linewidth: 1.5, alpha: undefined, whitelistFlag: false }],
})

export const addGuidelineToFrame = (frame: FrameConfig): FrameConfig => ({
  ...frame,
  guidelines: [...frame.guidelines, { m: 1, lineProps: { linestyle: '--', color: 'aqua', linewidth: 4 }, fontsize: 18, fontColor: '', label: '', labelAbove: true, labelPadding: 6 }],
})

export const updateGuidelineInFrame = (frame: FrameConfig, guidelineIndex: number, patch: (guideline: GuidelineConfig) => GuidelineConfig): FrameConfig => ({
  ...frame,
  guidelines: frame.guidelines.map((guideline, index) => (index === guidelineIndex ? patch(guideline) : guideline)),
})

/** Returns the label for one language; a plain-string label applies to every language. */
export const getLocalizedLabel = (label: GuidelineConfig['label'], language: string): string =>
  typeof label === 'string' ? label : label[language] ?? ''

/**
 * Sets the label for one language. The result always contains every plot language, because the
 * backend fails when a label dict lacks the active plot language.
 */
export const setLocalizedLabel = (label: GuidelineConfig['label'], language: string, value: string, languages: string[]): Record<string, string> => {
  const next: Record<string, string> = typeof label === 'string' ? {} : { ...label }
  for (const lang of languages) {
    next[lang] ??= getLocalizedLabel(label, lang)
  }
  next[language] = value
  return next
}

export const DEFAULT_ANNOTATION_SETTINGS: AnnotationConfig = { markerSize: 330, fontSize: 18 }

/** annotations[0] only holds default marker/font sizes; the backend draws annotations[1..]. */
export const addAnnotationToFrame = (frame: FrameConfig): FrameConfig => {
  const annotations = frame.annotations.length > 0 ? frame.annotations : [{ ...DEFAULT_ANNOTATION_SETTINGS }]
  return {
    ...frame,
    annotations: [...annotations, { text: { name: '', relPos: [0, 0], color: '#111827' }, axes: {}, marker: undefined, arrow: undefined }],
  }
}

const hsvToHex = (hue: number, saturation: number, value: number): string => {
  const c = value * saturation
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = value - c
  let rgb: [number, number, number] = [0, 0, 0]

  if (hue < 60) rgb = [c, x, 0]
  else if (hue < 120) rgb = [x, c, 0]
  else if (hue < 180) rgb = [0, c, x]
  else if (hue < 240) rgb = [0, x, c]
  else if (hue < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]

  return `#${rgb.map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')}`
}

/** Spreads hues evenly across all material keys; the `default` color is kept as it is. */
export const generateMaterialColorsForDataframe = (df: DataframeConfig): DataframeConfig => {
  const keys = Object.keys(df.materialColors).filter((key) => key !== 'default')
  if (keys.length === 0) return df
  const numberOfBrightnessLevels = Math.ceil(keys.length / 10)

  const generated = new Map(keys.map((key, index) => {
    const hue = (index / keys.length) * 360
    const brightness = 0.3 + (0.7 / numberOfBrightnessLevels / 2) * ((index % numberOfBrightnessLevels) * 2 + 1)
    return [key, hsvToHex(hue, 0.9, brightness)]
  }))
  // Rebuild in the original key order so the list in the UI does not jump.
  const nextColors = Object.fromEntries(Object.entries(df.materialColors).map(([key, color]) => [key, generated.get(key) ?? color]))

  return { ...df, materialColors: nextColors }
}
