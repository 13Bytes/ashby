import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(__dirname, '..', '..')
const plotPagePath = path.join(projectDir, 'src', 'components', 'PlotPage.tsx')
const appPath = path.join(projectDir, 'src', 'App.tsx')
const configIoPath = path.join(projectDir, 'src', 'utils', 'configIo.ts')

async function readSource(filePath) {
  return readFile(filePath, 'utf8')
}

test('PlotPage requests the render endpoint with active dataframe and frame indices', async () => {
  const source = await readSource(plotPagePath)

  assert.match(source, /fetch\('\/api\/render-plot'/)
  assert.match(source, /dataframe_index:\s*activeDataframeIndex/)
  assert.match(source, /frame_index:\s*activeFrameIndex/)
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
  const source = await readSource(appPath)

  assert.match(source, /importFileName:\s*payload\.import_file_name\s*\?\?\s*df\.importFileName/)
  assert.match(source, /<PlotPage plotConfig=\{plotConfig\} activeDataframeIndex=\{activeDataframeIndex\} activeFrameIndex=\{activeFrameIndex\} \/>/)
})

test('App only offers axis column options from imported config or datasource columns', async () => {
  const source = await readSource(appPath)

  assert.doesNotMatch(source, /const AXIS_COLUMN_OPTIONS:/)
  assert.match(source, /const availableAxisColumns = useMemo\(\s*\(\) => getAxisBasesFromColumns\(availableColumns\)/)
  assert.match(source, /axisColumnsPlaceholderEmpty/)
  assert.match(source, /No options available\./)
})

test('App uses a single spreadsheet upload flow that imports immediately', async () => {
  const source = await readSource(appPath)

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
