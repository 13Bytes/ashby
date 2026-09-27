import { createContext, useContext } from 'react'
import type { SettingsMode, SettingsSectionId } from '../config/settingsSections'

/** Shared by the settings sections: the display mode and jumping to another section or field. */
export type SettingsContextValue = {
  mode: SettingsMode
  /** Opens a section; with `anchor` it also scrolls to and highlights that field. */
  goTo: (section: SettingsSectionId, anchor?: string) => void
}

export const SettingsContext = createContext<SettingsContextValue>({ mode: 'simple', goTo: () => undefined })

export const useSettings = () => useContext(SettingsContext)
