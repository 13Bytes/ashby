import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(__dirname, '..', '..')
const plotPagePath = path.join(projectDir, 'src', 'components', 'PlotPage.tsx')
const appPath = path.join(projectDir, 'src', 'App.tsx')
const configSectionsPath = path.join(projectDir, 'src', 'components', 'ConfigSections.tsx')
const dataframeSectionPath = path.join(projectDir, 'src', 'components', 'DataframeSection.tsx')
const appControlsPath = path.join(projectDir, 'src', 'components', 'AppControls.tsx')
const appPopoutsPath = path.join(projectDir, 'src', 'components', 'AppPopouts.tsx')
const configIoPath = path.join(projectDir, 'src', 'utils', 'configIo.ts')
const configMappersPath = path.join(projectDir, 'src', 'config', 'configMappers.ts')
const datasourceStoragePath = path.join(projectDir, 'src', 'utils', 'datasourceStorage.ts')
const plotConfigActionsPath = path.join(projectDir, 'src', 'hooks', 'usePlotConfigActions.ts')

async function readSource(filePath) {
  return readFile(filePath, 'utf8')
}

test('PlotPage requests the render endpoint with active dataframe and frame indices', async () => {
  const source = await readSource(plotPagePath)

  assert.match(source, /fetch\(\s*'\/api\/render-plot'/)
  assert.match(source, /const fetchPlot = async \(dataframeIndex = activeDataframeIndex, frameIndex = activeFrameIndex/)
  assert.match(source, /dataframe_index:\s*dataframeIndex/)
  assert.match(source, /frame_index:\s*frameIndex/)
})

test('PlotPage renders the returned image blob into an img element', async () => {
  const source = await readSource(plotPagePath)

  assert.match(source, /const imageBlob = await response\.blob\(\)/)
  assert.match(source, /URL\.createObjectURL\(imageBlob\)/)
  assert.match(source, /<img src=\{imageUrl\} alt="Rendered Ashby plot"/)
})

test('PlotPage reads backend plot messages and renders them in the UI', async () => {
  const source = await readSource(plotPagePath)

  assert.match(source, /response\.headers\.get\('X-Ashby-Messages'\)/)
  assert.match(source, /function parseBackendMessages/)
  assert.match(source, /<strong>Plot messages<\/strong>/)
})

test('App passes active selection and datasource files into PlotPage', async () => {
  const source = `${await readSource(appPath)}\n${await readSource(configSectionsPath)}`

  assert.match(source, /setDatasourceFilesByDataframe/)
  assert.match(source, /importFileName:\s*payload\.import_file_name\s*\?\?\s*file\?\.name\s*\?\?\s*df\.importFileName/)
  assert.match(source, /<PlotPage[\s\S]*plotConfig=\{plotConfig\}[\s\S]*activeDataframeIndex=\{activeDataframeIndex\}[\s\S]*activeFrameIndex=\{activeFrameIndex\}/)
  assert.match(source, /datasourceFilesByDataframe=\{datasourceFilesByDataframe\}/)
})

test('PlotPage sends FormData with datasource descriptors when Excel files are available', async () => {
  const source = await readSource(plotPagePath)

  assert.match(source, /function buildPlotRequest/)
  assert.match(source, /new FormData\(\)/)
  assert.match(source, /form\.append\('payload', JSON\.stringify\(payload\)\)/)
  assert.match(source, /form\.append\('data_sources', JSON\.stringify\(descriptors\)\)/)
  assert.match(source, /kind:\s*'xlsx'/)
  assert.match(source, /Re-upload the Excel datasource/)
})

test('App restores Excel datasource files from browser storage and prompts when missing', async () => {
  const appSource = await readSource(appPath)
  const popoutSource = await readSource(appPopoutsPath)
  const storageSource = await readSource(datasourceStoragePath)

  assert.match(storageSource, /indexedDB\.open/)
  assert.match(storageSource, /cacheDatasourceFile/)
  assert.match(storageSource, /getCachedDatasourceFile/)
  assert.match(storageSource, /clearCachedDatasourceFiles/)
  assert.match(appSource, /getCachedDatasourceFile\(filename\)/)
  assert.match(appSource, /setDatasourcePrompt/)
  assert.match(appSource, /Excel datasource data missing/)
  assert.match(appSource, /Delete all stored files/)
  assert.match(appSource, /clearCachedDatasourceFiles\(\)/)
  assert.match(popoutSource, /Excel datasource required/)
  assert.match(popoutSource, /onDatasourcePromptFile/)
})

test('App warns when the backend health probe is unavailable', async () => {
  const source = await readSource(appPath)

  assert.match(source, /fetch\('\/api\/health', \{ cache: 'no-store' \}\)/)
  assert.match(source, /setBackendAvailable\(false\)/)
  assert.match(source, /backendAvailable === false/)
  assert.match(source, /t\('backendUnavailable'\)/)
})

test('App only offers axis column options from imported config or datasource columns', async () => {
  const source = `${await readSource(appPath)}\n${await readSource(configSectionsPath)}\n${await readSource(dataframeSectionPath)}\n${await readSource(appControlsPath)}`

  assert.doesNotMatch(source, /const AXIS_COLUMN_OPTIONS:/)
  assert.match(source, /const availableAxisColumns = useMemo\(\s*\(\) => getAxisBasesFromColumns\(availableColumns\)\.map/)
  assert.match(source, /No options available\./)
})

test('App uses a single spreadsheet upload flow that imports immediately', async () => {
  const source = `${await readSource(appPath)}\n${await readSource(dataframeSectionPath)}`

  assert.match(source, /const handleSpreadsheetSelection = async/)
  assert.match(source, /await importDatabase\(file\)/)
  assert.match(source, /t\('uploadAndImport'\)/)
  assert.doesNotMatch(source, /xlsxDataInputRef/)
})

test('toExternalConfig does not serialize empty layer names into the backend payload', async () => {
  const source = await readSource(configIoPath)

  assert.match(source, /const normalizedName = layer\.name\?\.trim\(\)/)
  assert.match(source, /\.\.\.\(normalizedName \? \{ name: normalizedName \} : \{\}\)/)
  assert.doesNotMatch(source, /name:\s*layer\.name \?\? ''/)
})

test('annotation edgecolor updates preserve fill color and language removal uses sibling buttons', async () => {
  const annotationsSource = await readSource(path.join(projectDir, 'src', 'components', 'AnnotationsSection.tsx'))
  const dataframeSource = await readSource(dataframeSectionPath)

  const edgecolorField = annotationsSource.slice(annotationsSource.indexOf('label="Marker edgecolors"'), annotationsSource.indexOf('</Field>', annotationsSource.indexOf('label="Marker edgecolors"')))
  assert.match(edgecolorField, /edgecolors: next/)
  assert.doesNotMatch(edgecolorField, /[, ]color: next/)
  assert.doesNotMatch(annotationsSource, /deiabled/)
  assert.match(dataframeSource, /<span key=\{language\}[\s\S]*aria-label=\{`Remove \$\{language\} language`\}/)
  assert.doesNotMatch(dataframeSource, /role="button"/)
})

test('reorderable config tabs use stable UI keys instead of array indices', async () => {
  const source = await readSource(path.join(projectDir, 'src', 'components', 'ConfigTabs.tsx'))

  assert.match(source, /key=\{getUiKey\(df, 'dataframe'\)\}/)
  assert.match(source, /key=\{getUiKey\(frame, 'frame'\)\}/)
  assert.doesNotMatch(source, /key=\{index\}/)
})

test('App exposes a persistent UI theme selector without forcing light mode', async () => {
  const source = await readSource(appPath)

  assert.match(source, /readStoredUITheme/)
  assert.match(source, /UI_THEME_STORAGE_KEY/)
  assert.match(source, /<option value="system">\{t\('themeSystem'\)\}<\/option>/)
  assert.doesNotMatch(source, /classList\.remove\('dark'\)/)
})

test('plot dark mode uses dataframe defaults and optional frame overrides', async () => {
  const configIoSource = await readSource(configIoPath)
  const mapperSource = await readSource(configMappersPath)
  const dataframeSource = await readSource(dataframeSectionPath)
  const actionsSource = await readSource(plotConfigActionsPath)

  assert.match(configIoSource, /frame\.darkMode === undefined \? \{\} : \{ dark_mode: frame\.darkMode \}/)
  assert.match(mapperSource, /darkMode: coerceOptionalBool\(partial\.darkMode \?\? partial\.dark_mode\)/)
  assert.match(dataframeSource, /label=\{t\('dataframeDarkMode'\)\}/)
  assert.match(actionsSource, /next\.darkMode = undefined/)
})

test('frame axis selectors expose required placeholders and ratio hover hints', async () => {
  const frameSource = await readSource(path.join(projectDir, 'src', 'components', 'FrameSection.tsx'))
  const controlsSource = await readSource(appControlsPath)
  const translationsSource = await readSource(path.join(projectDir, 'src', 'uiTranslations.ts'))

  assert.match(frameSource, /value=\{activeFrame\.xQuantity \?\? ''\}/)
  assert.match(frameSource, /value="" disabled>Select required axis<\/option>/)
  assert.match(controlsSource, /aria-label=\{`\$\{label\} help`\}/)
  assert.match(translationsSource, /Divides the absolute X value by the selected axis/)
})

test('spreadsheet upload fields explain the backend dependency through hover hints', async () => {
  const translationsSource = await readSource(path.join(projectDir, 'src', 'uiTranslations.ts'))

  assert.match(translationsSource, /Importing requires the Python backend server to be running/)
  assert.match(translationsSource, /Zero-based worksheet index to import/)
})

test('backend-format nested frame objects are normalized for the frontend editor', async () => {
  const mapperSource = await readSource(configMappersPath)
  const configIoSource = await readSource(configIoPath)

  assert.match(mapperSource, /guideline\.lineProps \?\? guideline\.line_props/)
  assert.match(mapperSource, /layer\.alphaPoints \?\? layer\.alpha_points/)
  assert.match(mapperSource, /marker\.markerSymbol \?\? marker\.marker_symbol/)
  assert.match(mapperSource, /const excelImportFallback = importFileName \? true : apiKey \|\| teableUrl \? false : fallback\.excelImport/)
  assert.match(mapperSource, /excelImport: coerceBool\(partial\.excelImport \?\? partial\.excel_import, excelImportFallback\)/)
  assert.match(configIoSource, /tick_size: dataframe\.font\.tickSize/)
  assert.match(configIoSource, /legend_size: dataframe\.font\.legendSize/)
})
