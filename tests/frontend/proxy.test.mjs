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
const configIoPath = path.join(projectDir, 'src', 'utils', 'configIo.ts')
const configMappersPath = path.join(projectDir, 'src', 'config', 'configMappers.ts')
const plotConfigActionsPath = path.join(projectDir, 'src', 'hooks', 'usePlotConfigActions.ts')

async function readSource(filePath) {
  return readFile(filePath, 'utf8')
}

test('PlotPage requests the render endpoint with active dataframe and frame indices', async () => {
  const source = await readSource(plotPagePath)

  assert.match(source, /fetch\('\/api\/render-plot'/)
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

test('App passes active selection into PlotPage and persists uploaded import_file_name', async () => {
  const source = `${await readSource(appPath)}\n${await readSource(configSectionsPath)}`

  assert.match(source, /importFileName:\s*payload\.import_file_name\s*\?\?\s*file\?\.name\s*\?\?\s*df\.importFileName/)
  assert.match(source, /<PlotPage[\s\S]*plotConfig=\{plotConfig\}[\s\S]*activeDataframeIndex=\{activeDataframeIndex\}[\s\S]*activeFrameIndex=\{activeFrameIndex\}/)
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
