import type { ComponentProps } from 'react'
import type { SettingsSectionId } from '../config/settingsSections'
import { AdvancedJsonSection } from './AdvancedJsonSection'
import { AnnotationsSection } from './AnnotationsSection'
import { AxesSection } from './AxesSection'
import { ColoredAreasSection } from './ColoredAreasSection'
import { DataSection } from './DataSection'
import { FrameSection } from './FrameSection'
import { GuidelinesSection } from './GuidelinesSection'
import { ImageOutputSection } from './ImageOutputSection'
import { LayersSection } from './LayersSection'
import { MaterialColorsSection } from './MaterialColorsSection'
import { SettingsSection } from './SettingsSection'
import { TextLookSection } from './TextLookSection'

type Props =
  & ComponentProps<typeof DataSection>
  & ComponentProps<typeof TextLookSection>
  & ComponentProps<typeof AxesSection>
  & ComponentProps<typeof MaterialColorsSection>
  & ComponentProps<typeof ImageOutputSection>
  & ComponentProps<typeof FrameSection>
  & ComponentProps<typeof LayersSection>
  & ComponentProps<typeof ColoredAreasSection>
  & ComponentProps<typeof GuidelinesSection>
  & ComponentProps<typeof AnnotationsSection>
  & ComponentProps<typeof AdvancedJsonSection>
  & {
    activeSection: SettingsSectionId
    shownDefaults: ReadonlySet<SettingsSectionId>
    onToggleDefaults: (id: SettingsSectionId) => void
  }

/** Renders every settings section; only the active one is visible. Each section picks the props it needs from the shared bag. */
export function ConfigSections(props: Props) {
  const { activeSection, shownDefaults, onToggleDefaults } = props
  const section = (id: SettingsSectionId) => ({ id, active: activeSection === id, showDefaults: shownDefaults.has(id), onToggleDefaults })
  return (
    <>
      <SettingsSection {...section('data')}><DataSection {...props} /></SettingsSection>
      <SettingsSection {...section('textLook')}><TextLookSection {...props} /></SettingsSection>
      <SettingsSection {...section('axisDefs')}><AxesSection {...props} /></SettingsSection>
      <SettingsSection {...section('materials')}><MaterialColorsSection {...props} /></SettingsSection>
      <SettingsSection {...section('output')}><ImageOutputSection {...props} /></SettingsSection>
      <SettingsSection {...section('titleAxes')}><FrameSection {...props} /></SettingsSection>
      <SettingsSection {...section('hulls')}><LayersSection {...props} /></SettingsSection>
      <SettingsSection {...section('extras')}>
        <ColoredAreasSection {...props} />
        <GuidelinesSection {...props} />
        <AnnotationsSection {...props} />
      </SettingsSection>
      <SettingsSection {...section('json')}><AdvancedJsonSection {...props} /></SettingsSection>
    </>
  )
}
