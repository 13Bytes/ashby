import type { FrameConfig, PlotAxes } from '../config/defaultPlotConfig'
import { useI18n } from '../uiTranslations'
import { plotAxesChanged, plotAxesOf } from '../utils/configEditing'

const describe = ([x, y]: PlotAxes) => `X · ${x || '–'}, Y · ${y || '–'}`

/**
 * Warning text for coordinates that were entered for other plot axes than the frame shows now,
 * undefined while they still fit (or nothing was noted, as in older configs).
 */
export function useAxesWarning(frame: FrameConfig) {
  const { t } = useI18n()
  return (recorded: PlotAxes | undefined) =>
    recorded && plotAxesChanged(recorded, frame) ? t('axesChanged', { then: describe(recorded), now: describe(plotAxesOf(frame)) }) : undefined
}
