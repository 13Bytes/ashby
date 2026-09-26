import type { ComponentProps } from 'react'
import { AdvancedJsonSection } from './AdvancedJsonSection'
import { AnnotationsSection } from './AnnotationsSection'
import { AxesSection } from './AxesSection'
import { ColoredAreasSection } from './ColoredAreasSection'
import { DataframeSection } from './DataframeSection'
import { FrameSection } from './FrameSection'
import { GuidelinesSection } from './GuidelinesSection'
import { LayersSection } from './LayersSection'
import { MaterialColorsSection } from './MaterialColorsSection'

type Props =
  & ComponentProps<typeof DataframeSection>
  & ComponentProps<typeof MaterialColorsSection>
  & ComponentProps<typeof AxesSection>
  & ComponentProps<typeof FrameSection>
  & ComponentProps<typeof LayersSection>
  & ComponentProps<typeof ColoredAreasSection>
  & ComponentProps<typeof GuidelinesSection>
  & ComponentProps<typeof AnnotationsSection>
  & ComponentProps<typeof AdvancedJsonSection>

/** Renders all config sections; each section picks the props it needs from the shared bag. */
export function ConfigSections(props: Props) {
  return (
    <>
      <DataframeSection {...props} />
      <MaterialColorsSection {...props} />
      <AxesSection {...props} />
      <FrameSection {...props} />
      <LayersSection {...props} />
      <ColoredAreasSection {...props} />
      <GuidelinesSection {...props} />
      <AnnotationsSection {...props} />
      <AdvancedJsonSection {...props} />
    </>
  )
}
