import type { ComponentProps } from 'react'
import { isHiddenInMode, type SettingsSectionId } from '../config/settingsSections'
import { useI18n } from '../uiTranslations'
import { dataframeLabel } from '../utils/appState'
import { useSettings } from '../utils/settingsContext'
import { AdvancedJsonSection } from './AdvancedJsonSection'
import { AnnotationsSection } from './AnnotationsSection'
import { ScopeTag } from './AppControls'
import { AxesSection } from './AxesSection'
import { ColoredAreasSection } from './ColoredAreasSection'
import { DataSection } from './DataSection'
import { FrameSection } from './FrameSection'
import { GuidelinesSection } from './GuidelinesSection'
import { LayersSection } from './LayersSection'
import { MaterialColorsSection } from './MaterialColorsSection'
import { SettingsSection } from './SettingsSection'
import { TextLookSection } from './TextLookSection'

type Props =
  & ComponentProps<typeof DataSection>
  & ComponentProps<typeof TextLookSection>
  & ComponentProps<typeof AxesSection>
  & ComponentProps<typeof MaterialColorsSection>
  & ComponentProps<typeof FrameSection>
  & ComponentProps<typeof LayersSection>
  & ComponentProps<typeof ColoredAreasSection>
  & ComponentProps<typeof GuidelinesSection>
  & ComponentProps<typeof AnnotationsSection>
  & ComponentProps<typeof AdvancedJsonSection>
  & {
    activeSection: SettingsSectionId
    /** All sections below each other instead of only the active one. */
    scrollSections: boolean
    shownDefaults: ReadonlySet<SettingsSectionId>
    onToggleDefaults: (id: SettingsSectionId) => void
  }

/**
 * Renders the settings sections: either all below each other (the shared dataset sections first,
 * then the sections of the active plot) or only the active one. Hidden sections stay rendered so
 * "Find a setting" reaches all fields. Each section picks the props it needs from the shared bag.
 */
export function ConfigSections(props: Props) {
  const { activeSection, scrollSections, shownDefaults, onToggleDefaults, activeDataframe, activeDataframeIndex, activeFrame } = props
  const { t } = useI18n()
  const { mode } = useSettings()
  const section = (id: SettingsSectionId) => ({
    id,
    hidden: isHiddenInMode(id, mode) || (!scrollSections && activeSection !== id),
    showDefaults: shownDefaults.has(id),
    onToggleDefaults,
  })
  const divider = scrollSections ? <hr className="my-3 border-zinc-200 dark:border-zinc-800" /> : null
  const scopeBanner = (scope: 'dataset' | 'plot', name: string) => scrollSections && (
    <div className={`flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2 ${scope === 'dataset' ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40' : 'mt-8 border-violet-500 bg-violet-50 dark:bg-violet-950/40'}`}>
      <ScopeTag scope={scope}>{t(scope === 'dataset' ? 'datasetShared' : 'plotOnly')}</ScopeTag>
      <strong className="min-w-0 truncate text-sm">{name}</strong>
    </div>
  )
  return (
    <>
      {scopeBanner('dataset', dataframeLabel(activeDataframe, activeDataframeIndex))}
      <SettingsSection {...section('data')}><DataSection {...props} /></SettingsSection>
      {divider}
      <SettingsSection {...section('textLook')}><TextLookSection {...props} /></SettingsSection>
      {isHiddenInMode('textLook', mode) ? null : divider}
      <SettingsSection {...section('axisDefs')}><AxesSection {...props} /></SettingsSection>
      {divider}
      <SettingsSection {...section('materials')}><MaterialColorsSection {...props} /></SettingsSection>
      {scopeBanner('plot', activeFrame.name || 'Frame')}
      <SettingsSection {...section('titleAxes')}><FrameSection {...props} /></SettingsSection>
      {divider}
      <SettingsSection {...section('hulls')}><LayersSection {...props} /></SettingsSection>
      {divider}
      <SettingsSection {...section('extras')}>
        <ColoredAreasSection {...props} />
        <GuidelinesSection {...props} />
        <AnnotationsSection {...props} />
      </SettingsSection>
      {divider}
      <SettingsSection {...section('json')}><AdvancedJsonSection {...props} /></SettingsSection>
    </>
  )
}
