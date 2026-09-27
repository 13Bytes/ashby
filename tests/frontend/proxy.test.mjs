// Wiring checks for React components that cannot be exercised without a browser. They match
// identifiers, endpoints and translation keys rather than UI text, so wording changes and
// translations do not break them. Behavior of the pure modules is covered in utils.test.mjs.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const readSource = (relativePath) => readFile(path.join(projectDir, 'src', relativePath), 'utf8')

test('PlotPage requests the render endpoint with the dataframe and frame indices', async () => {
  const source = await readSource('components/PlotPage.tsx')

  assert.match(source, /fetchBackend\(\s*'\/api\/render-plot'/)
  assert.match(source, /include_log: true/)
  assert.match(source, /request_id: statusId/)
  assert.match(source, /\/api\/render-status\//)
  assert.match(source, /timeoutMs: RENDER_TIMEOUT_MS/)
  assert.match(source, /dataframe_index:\s*dataframeIndex/)
  assert.match(source, /frame_index:\s*frameIndex/)
  assert.match(source, /URL\.createObjectURL\(imageBlob\)/)
  assert.match(source, /<img src=\{imageUrl\}/)
})

test('PlotPage shows backend plot messages', async () => {
  const source = await readSource('components/PlotPage.tsx')

  assert.match(source, /response\.headers\.get\('X-Ashby-Messages'\)/)
  assert.match(source, /t\('plotMessages'\)/)
})

test('PlotPage sends Excel datasources as FormData with descriptors', async () => {
  const source = await readSource('components/PlotPage.tsx')

  assert.match(source, /form\.append\('payload', JSON\.stringify\(payload\)\)/)
  assert.match(source, /form\.append\('data_sources', JSON\.stringify\(descriptors\)\)/)
  assert.match(source, /kind:\s*'xlsx'/)
  assert.match(source, /t\('reuploadDatasource'/)
})

test('App passes the selection and datasource files into PlotPage', async () => {
  const source = await readSource('App.tsx')

  assert.match(source, /<PlotPage[\s\S]*plotConfig=\{plotConfig\}[\s\S]*activeDataframeIndex=\{activeDataframeIndex\}[\s\S]*activeFrameIndex=\{activeFrameIndex\}/)
  assert.match(source, /datasourceFilesByDataframe=\{datasourceFilesByDataframe\}/)
  assert.match(source, /importFileName:\s*payload\.import_file_name\s*\?\?\s*file\?\.name\s*\?\?\s*df\.importFileName/)
})

test('App loads the dataset catalog and probes backend health', async () => {
  const source = await readSource('App.tsx')

  assert.match(source, /fetch\('\/api\/import-database\/datasets'/)
  assert.match(source, /fetch\('\/api\/health', \{ cache: 'no-store', signal: AbortSignal\.timeout\(/)
  assert.match(source, /backendAvailable === false/)
  assert.match(source, /t\('backendUnavailable'\)/)
})

test('App restores Excel datasources from browser storage and prompts when missing', async () => {
  const appSource = await readSource('App.tsx')
  const storageSource = await readSource('utils/datasourceStorage.ts')

  assert.match(storageSource, /indexedDB\.open/)
  assert.match(appSource, /getCachedDatasourceFile\(filename\)/)
  assert.match(appSource, /setDatasourcePrompt/)
  assert.match(appSource, /clearCachedDatasourceFiles\(\)/)
})

test('App keeps datasource import results per dataframe', async () => {
  const source = await readSource('App.tsx')

  assert.match(source, /importedSources\[activeDataframeKey\]/)
  assert.match(source, /\[selectedDataframeKey\]: \{ columns, keywordsByColumn, sheets: sheetNames \}/)
})

test('App syncs the config with tabs of the same workspace', async () => {
  const source = await readSource('App.tsx')

  assert.match(source, /createConfigSync\(/)
  assert.match(source, /configSyncRef\.current\?\.publish\(serialized\)/)
})

test('config tabs use stable UI keys instead of array indices', async () => {
  const source = await readSource('components/ConfigTabs.tsx')

  assert.match(source, /key=\{getUiKey\(df, 'dataframe'\)\}/)
  assert.match(source, /key=\{getUiKey\(frame, 'frame'\)\}/)
  assert.doesNotMatch(source, /key=\{index\}/)
})

test('App exposes a persistent UI theme selector without forcing light mode', async () => {
  const source = await readSource('App.tsx')

  assert.match(source, /readStoredUITheme/)
  assert.match(source, /UI_THEME_STORAGE_KEY/)
  assert.doesNotMatch(source, /classList\.remove\('dark'\)/)
})
