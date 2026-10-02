import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import type { FrameConfig, GuidelineConfig } from '../../config/defaultPlotConfig'
import { isHiddenInMode, type SettingsSectionId } from '../../config/settingsSections'
import { useI18n } from '../../uiTranslations'
import { dataframeLabel, frameLabel } from '../../utils/appState'
import { addGuidelineToFrame, addLayerToFrame, updateGuidelineInFrame } from '../../utils/configEditing'
import { useSettings } from '../../utils/settingsContext'
import { AnnotationsSection } from './AnnotationsSection'
import { ScopeTag } from '../common/AppControls'
import { AxesSection } from './AxesSection'
import { ColoredAreasSection } from './ColoredAreasSection'
import { DataSection } from './DataSection'
import { FilterSection } from './FilterSection'
import { FrameSection } from './FrameSection'
import { GuidelinesSection } from './GuidelinesSection'
import { LayersSection } from './LayersSection'
import { MaterialColorsSection } from './MaterialColorsSection'
import { SettingsSection } from './SettingsSection'
import { TextLookSection } from './TextLookSection'

/** What each plot's sections get for their own frame instead of the active one. */
type FrameBound = 'activeFrame' | 'patchActiveFrame' | 'addLayer' | 'addGuideline' | 'updateGuideline' | 'expandedLayerKeywords' | 'setExpandedLayerKeywords'

type Props =
  & ComponentProps<typeof DataSection>
  & ComponentProps<typeof TextLookSection>
  & ComponentProps<typeof AxesSection>
  & ComponentProps<typeof MaterialColorsSection>
  & Omit<
    & ComponentProps<typeof FrameSection>
    & ComponentProps<typeof LayersSection>
    & ComponentProps<typeof FilterSection>
    & ComponentProps<typeof ColoredAreasSection>
    & ComponentProps<typeof GuidelinesSection>
    & ComponentProps<typeof AnnotationsSection>,
    FrameBound
  >
  & {
    activeFrameIndex: number
    /** Patches a frame of the active dataframe. */
    patchFrame: (frameIndex: number, patch: (frame: FrameConfig) => FrameConfig) => void
    /** Expanded keyword lists of the layers, per frame UI key. */
    expandedLayerKeywordsByFrame: Record<string, Record<number, boolean>>
    setExpandedLayerKeywordsByFrame: Dispatch<SetStateAction<Record<string, Record<number, boolean>>>>
    /** Editing a field of another plot makes that plot the active one (preview, tabs). */
    onActivateFrame: (frameIndex: number) => void
    activeSection: SettingsSectionId
    /** All sections below each other instead of only the active one. */
    scrollSections: boolean
    shownDefaults: ReadonlySet<SettingsSectionId>
    onToggleDefaults: (id: SettingsSectionId) => void
  }

/**
 * Renders the settings sections: either all below each other (the shared dataset sections first,
 * then the sections of every plot of the dataset) or only the active one (of the active plot).
 * Hidden sections stay rendered so "Find a setting" reaches all fields, of every plot. Each section
 * picks the props it needs from the shared bag; the plot sections get their own frame's.
 */
export function ConfigSections(props: Props) {
  const {
    activeSection, scrollSections, shownDefaults, onToggleDefaults, activeDataframe, activeDataframeIndex, activeFrameIndex,
    patchFrame, expandedLayerKeywordsByFrame, setExpandedLayerKeywordsByFrame, onActivateFrame,
  } = props
  const { t } = useI18n()
  const { mode } = useSettings()
  const section = (id: SettingsSectionId, frameIndex?: number) => ({
    id,
    frameIndex,
    hidden: isHiddenInMode(id, mode) || (!scrollSections && (activeSection !== id || (frameIndex !== undefined && frameIndex !== activeFrameIndex))),
    showDefaults: shownDefaults.has(id),
    onToggleDefaults,
  })
  const divider = scrollSections ? <hr className="my-3 border-zinc-200 dark:border-zinc-800" /> : null
  const scopeBanner = (scope: 'dataset' | 'plot', name: string) => scrollSections && (
    <div className={`flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2 ${scope === 'dataset' ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40' : 'mt-8 border-brand-500 bg-brand-50 dark:bg-brand-950/40'}`}>
      <ScopeTag scope={scope}>{t(scope === 'dataset' ? 'datasetShared' : 'plotOnly')}</ScopeTag>
      <strong className="min-w-0 truncate text-sm">{name}</strong>
    </div>
  )
  const frameSections = (frame: FrameConfig, frameIndex: number) => {
    const key = String(frame._extensions.uiKey)
    const patchActiveFrame = (patch: (current: FrameConfig) => FrameConfig) => patchFrame(frameIndex, patch)
    const frameProps = {
      ...props,
      activeFrame: frame,
      patchActiveFrame,
      addLayer: () => patchActiveFrame(addLayerToFrame),
      addGuideline: () => patchActiveFrame(addGuidelineToFrame),
      updateGuideline: (guidelineIndex: number, patch: (guideline: GuidelineConfig) => GuidelineConfig) => patchActiveFrame((current) => updateGuidelineInFrame(current, guidelineIndex, patch)),
      expandedLayerKeywords: expandedLayerKeywordsByFrame[key] ?? {},
      setExpandedLayerKeywords: (update: SetStateAction<Record<number, boolean>>) =>
        setExpandedLayerKeywordsByFrame((current) => ({ ...current, [key]: typeof update === 'function' ? update(current[key] ?? {}) : update })),
    }
    return (
      // "contents": the sections stay items of the editor grid
      <div key={key} className="contents" onFocusCapture={() => { if (frameIndex !== activeFrameIndex) onActivateFrame(frameIndex) }}>
        {scopeBanner('plot', frameLabel(frame, frameIndex))}
        <SettingsSection {...section('titleAxes', frameIndex)}><FrameSection {...frameProps} /></SettingsSection>
        {divider}
        <SettingsSection {...section('hulls', frameIndex)}>
          <LayersSection {...frameProps} />
          <FilterSection {...frameProps} />
        </SettingsSection>
        {divider}
        <SettingsSection {...section('extras', frameIndex)}>
          <ColoredAreasSection {...frameProps} />
          <GuidelinesSection {...frameProps} />
          <AnnotationsSection {...frameProps} />
        </SettingsSection>
      </div>
    )
  }
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
      {activeDataframe.frames.map(frameSections)}
    </>
  )
}
