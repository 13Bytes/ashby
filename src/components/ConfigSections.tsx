import { AXIS_MODES, PLOT_ALGORITHMS } from '../config/defaultPlotConfig'
import { AdvancedJsonSection } from './AdvancedJsonSection'
import { AnnotationsSection } from './AnnotationsSection'
import { AxesSection } from './AxesSection'
import { ColoredAreasSection } from './ColoredAreasSection'
import { CUSTOM_SELECT_VALUE, FONT_FAMILY_OPTIONS, FONT_STYLE_OPTIONS } from '../config/uiOptions'
import { ColorOrMaterialInput, Field, MultiSelectInput, RemoveIconButton } from './AppControls'
import { DataframeSection } from './DataframeSection'
import { FrameSection } from './FrameSection'
import { GuidelinesSection } from './GuidelinesSection'
import { LayersSection } from './LayersSection'
import { MaterialColorsSection } from './MaterialColorsSection'

type Props = Record<string, any>

export function ConfigSections(props: Props) {
  const {
    activeDataframe,
    activeDataframeIndex,
    activeFrame,
    addAxis,
    addGuideline,
    addLayer,
    addPlotLanguage,
    availableAxisColumns,
    availableKeywordsByColumn,
    availableWhitelistKeywords,
    automaticDisplayAreaActive,
    customMaterialNames,
    expandedAxisColumns,
    expandedLayerKeywords,
    handlePlotLanguageKeyDown,
    handleSpreadsheetSelection,
    hoveredRemoveGroup,
    importDatabase,
    importInProgress,
    importedDatabaseStatus,
    materialColorOptions,
    materialKeywordOptions,
    numberValue,
    parseJsonField,
    patchActiveDataframe,
    patchActiveFrame,
    plotLanguageDraft,
    removeAxis,
    setCustomMaterialNames,
    setExpandedAxisColumns,
    setExpandedLayerKeywords,
    setHoveredRemoveGroup,
    setPlotLanguageDraft,
    setShowGenerateColorsConfirm,
    t,
    uiLanguage,
    updateAxis,
    updateGuideline,
    updateLanguages,
    uploadInputRef,
    layerNameOptions,
  } = props

  return (
    <>
      <DataframeSection
        t={t}
        uiLanguage={uiLanguage}
        activeDataframe={activeDataframe}
        patchActiveDataframe={patchActiveDataframe}
        numberValue={numberValue}
        FONT_STYLE_OPTIONS={FONT_STYLE_OPTIONS}
        FONT_FAMILY_OPTIONS={FONT_FAMILY_OPTIONS}
        CUSTOM_SELECT_VALUE={CUSTOM_SELECT_VALUE}
        importInProgress={importInProgress}
        importDatabase={importDatabase}
        uploadInputRef={uploadInputRef}
        handleSpreadsheetSelection={handleSpreadsheetSelection}
        importedDatabaseStatus={importedDatabaseStatus}
        activeDataframeIndex={activeDataframeIndex}
        plotLanguageDraft={plotLanguageDraft}
        setPlotLanguageDraft={setPlotLanguageDraft}
        handlePlotLanguageKeyDown={handlePlotLanguageKeyDown}
        addPlotLanguage={addPlotLanguage}
        updateLanguages={updateLanguages}
        FieldComponent={Field}
      />

      <AxesSection
        t={t}
        uiLanguage={uiLanguage}
        activeDataframe={activeDataframe}
        hoveredRemoveGroup={hoveredRemoveGroup}
        setHoveredRemoveGroup={setHoveredRemoveGroup}
        addAxis={addAxis}
        removeAxis={removeAxis}
        updateAxis={updateAxis}
        availableAxisColumns={availableAxisColumns}
        expandedAxisColumns={expandedAxisColumns}
        setExpandedAxisColumns={setExpandedAxisColumns}
        AXIS_MODES={AXIS_MODES}
        FieldComponent={Field}
        MultiSelectInputComponent={MultiSelectInput}
        RemoveIconButtonComponent={RemoveIconButton}
      />

      <LayersSection
        t={t}
        uiLanguage={uiLanguage}
        activeFrame={activeFrame}
        hoveredRemoveGroup={hoveredRemoveGroup}
        setHoveredRemoveGroup={setHoveredRemoveGroup}
        patchActiveFrame={patchActiveFrame}
        addLayer={addLayer}
        layerNameOptions={layerNameOptions}
        availableKeywordsByColumn={availableKeywordsByColumn}
        availableWhitelistKeywords={availableWhitelistKeywords}
        expandedLayerKeywords={expandedLayerKeywords}
        setExpandedLayerKeywords={setExpandedLayerKeywords}
        numberValue={numberValue}
        FieldComponent={Field}
        MultiSelectInputComponent={MultiSelectInput}
        RemoveIconButtonComponent={RemoveIconButton}
      />

      <ColoredAreasSection
        t={t}
        uiLanguage={uiLanguage}
        activeFrame={activeFrame}
        hoveredRemoveGroup={hoveredRemoveGroup}
        setHoveredRemoveGroup={setHoveredRemoveGroup}
        patchActiveFrame={patchActiveFrame}
        parseJsonField={parseJsonField}
        numberValue={numberValue}
        materialColorOptions={materialColorOptions}
        FieldComponent={Field}
        RemoveIconButtonComponent={RemoveIconButton}
        ColorOrMaterialInputComponent={ColorOrMaterialInput}
      />

      <FrameSection
        t={t}
        uiLanguage={uiLanguage}
        activeFrame={activeFrame}
        activeDataframe={activeDataframe}
        patchActiveFrame={patchActiveFrame}
        patchActiveDataframe={patchActiveDataframe}
        PLOT_ALGORITHMS={PLOT_ALGORITHMS}
        automaticDisplayAreaActive={automaticDisplayAreaActive}
        numberValue={numberValue}
        FieldComponent={Field}
      />

      <GuidelinesSection
        t={t}
        uiLanguage={uiLanguage}
        activeFrame={activeFrame}
        hoveredRemoveGroup={hoveredRemoveGroup}
        setHoveredRemoveGroup={setHoveredRemoveGroup}
        patchActiveFrame={patchActiveFrame}
        updateGuideline={updateGuideline}
        addGuideline={addGuideline}
        materialColorOptions={materialColorOptions}
        numberValue={numberValue}
        FieldComponent={Field}
        RemoveIconButtonComponent={RemoveIconButton}
        ColorOrMaterialInputComponent={ColorOrMaterialInput}
      />

      <AnnotationsSection
        t={t}
        uiLanguage={uiLanguage}
        activeFrame={activeFrame}
        hoveredRemoveGroup={hoveredRemoveGroup}
        setHoveredRemoveGroup={setHoveredRemoveGroup}
        patchActiveFrame={patchActiveFrame}
        numberValue={numberValue}
        materialColorOptions={materialColorOptions}
        FieldComponent={Field}
        RemoveIconButtonComponent={RemoveIconButton}
        ColorOrMaterialInputComponent={ColorOrMaterialInput}
      />

      <MaterialColorsSection
        t={t}
        activeDataframe={activeDataframe}
        customMaterialNames={customMaterialNames}
        setCustomMaterialNames={setCustomMaterialNames}
        materialKeywordOptions={materialKeywordOptions}
        CUSTOM_SELECT_VALUE={CUSTOM_SELECT_VALUE}
        patchActiveDataframe={patchActiveDataframe}
        setShowGenerateColorsConfirm={setShowGenerateColorsConfirm}
      />

      <AdvancedJsonSection
        t={t}
        uiLanguage={uiLanguage}
        activeFrame={activeFrame}
        patchActiveFrame={patchActiveFrame}
        parseJsonField={parseJsonField}
        FieldComponent={Field}
      />
    </>
  )
}
