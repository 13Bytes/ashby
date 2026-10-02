// Wiring checks for React components that cannot be exercised without a browser. They match
// identifiers, endpoints and translation keys rather than UI text, so wording changes and
// translations do not break them. Behavior of the pure modules is covered in utils.test.mjs.
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const readSource = (relativePath) => readFile(path.join(projectDir, 'src', relativePath), 'utf8')

test('PlotPage requests the render endpoint with the dataframe and frame indices', async () => {
  const source = await readSource('components/layout/PlotPage.tsx')

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
  const source = await readSource('components/layout/PlotPage.tsx')

  assert.match(source, /response\.headers\.get\('X-Ashby-Messages'\)/)
  assert.match(source, /t\('plotMessages'\)/)
})

test('PlotPage sends Excel datasources as FormData with descriptors', async () => {
  const source = await readSource('components/layout/PlotPage.tsx')

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
  assert.match(source, /\[selectedDataframeKey\]: \{ columns, keywordsByColumn, sheets: sheetNames, formatWarnings, valueCounts: payload\.value_counts \?\? \{\}, preview: payload\.preview \}/)
  // Excel files and import status stay with their dataframe when dataframes are reordered or removed.
  assert.match(source, /\[selectedDataframeKey\]: cachedFile/)
  assert.match(source, /\[selectedDataframeKey\]: \{ imported: true, source: selectedSourceMode \}/)
  assert.match(source, /byDataframeIndex\(dataframeKeys, datasourceFilesByKey\)/)
  assert.doesNotMatch(source, /\[activeDataframeIndex\]: cachedFile/)
})

test('App syncs the config with tabs of the same workspace', async () => {
  const source = await readSource('App.tsx')

  assert.match(source, /createConfigSync\(/)
  assert.match(source, /configSyncRef\.current\?\.publish\(serialized\)/)
})

test('config tabs use stable UI keys instead of array indices', async () => {
  const source = await readSource('components/layout/ConfigTabs.tsx')

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

test('scrolling through all settings sections is a setting that is off by default', async () => {
  const app = await readSource('App.tsx')
  const sections = await readSource('components/settings/ConfigSections.tsx')

  assert.match(app, /readStored\(SCROLL_SECTIONS_STORAGE_KEY, \(value\) => value === 'true'\)/)
  assert.match(app, /label=\{t\('scrollSections'\)\}/)
  assert.match(app, /if \(!editor \|\| !scrollSections\) return/)
  assert.match(sections, /hidden: isHiddenInMode\(id, mode\) \|\| \(!scrollSections && \(activeSection !== id \|\| \(frameIndex !== undefined && frameIndex !== activeFrameIndex\)\)\)/)
})

test('the sidebar and the editor have the plot sections of every plot of the dataset', async () => {
  const sections = await readSource('components/settings/ConfigSections.tsx')
  const nav = await readSource('components/layout/SettingsNav.tsx')
  const app = await readSource('App.tsx')

  assert.match(sections, /activeDataframe\.frames\.map\(frameSections\)/)
  assert.match(sections, /section\('hulls', frameIndex\)/)
  assert.match(nav, /frameNames\.map\(\(frameName, frameIndex\) =>/)
  assert.match(nav, /onSelect\(section\.id, frameIndex\)/)
  // the scroll position and search hits select the plot of the section
  assert.match(app, /if \(current\.dataset\.frameIndex !== undefined\) setActiveFrameIndex\(Number\(current\.dataset\.frameIndex\)\)/)
  assert.match(app, /closest<HTMLElement>\('\[data-frame-index\]'\)/)
})

test('image output (with aspect ratio and dark mode) is a group of Text & look that the export dialog links to', async () => {
  const textLook = await readSource('components/settings/TextLookSection.tsx')
  const output = await readSource('components/settings/ImageOutputSection.tsx')
  const plotPage = await readSource('components/layout/PlotPage.tsx')

  assert.match(textLook, /<SettingsGroup title=\{t\('secOutput'\)\} level="default" anchor="output">/)
  for (const path of ['image_ratio', 'dark_mode', 'fileformat', 'resolution', 'transparent', 'watermark', 'copyright']) {
    assert.ok(output.includes(`jsonPath="dataframes[i].${path}"`), path)
  }
  assert.match(plotPage, /onJump\('textLook', 'output'\)/)
})

test('datasource files are kept as in-memory copies and read with the stored copy as fallback', async () => {
  const app = await readSource('App.tsx')
  const plotPage = await readSource('components/layout/PlotPage.tsx')

  assert.match(app, /cachedFile = await toMemoryFile\(file, filename\)/)
  assert.match(plotPage, /readDatasourceWithFallback\(file, \(\) => getCachedDatasourceFile\(file\.name\)/)
})

test('middle click on a dataset or plot opens a synced tab on auxclick, which Firefox allows to open tabs', async () => {
  const tabs = await readSource('components/layout/ConfigTabs.tsx')
  const app = await readSource('App.tsx')

  assert.match(tabs, /onAuxClick: \(event: MouseEvent<HTMLElement>\) => \{/)
  assert.doesNotMatch(tabs, /onMouseDown=\{[^}]*openTabWithSelection/)
  assert.equal(tabs.match(/\.\.\.middleClickOpens\(\(\) => openTabWithSelection\(/g)?.length, 2)
  // No 'noopener': the new tab must inherit the sessionStorage (config and workspace id).
  assert.match(app, /window\.open\(`\$\{window\.location\.pathname\}\?\$\{params\.toString\(\)\}`, '_blank'\)/)
})

test('the app loads nothing from other servers: no web fonts, CDNs or trackers', async () => {
  const files = (await readdir(path.join(projectDir, 'src'), { recursive: true }))
    .filter((file) => /\.(tsx?|css|html)$/.test(file))
    .map((file) => path.join('src', file))
  files.push('index.html')
  // Plain links the user can click (About dialog, overview, privacy notice) are fine; they load nothing by themselves.
  const allowedLinks = [
    'https://aerospace-lab.de/repolysat/', 'https://aerospace-lab.de/', 'https://aerospace-lab.de/impressum/', 'https://aerospace-lab.de/datenschutz/',
    'https://ksat-stuttgart.de/en/projects/source-2/',
    'https://github.com/walgren/Ashby-plots', 'https://github.com/afffe18', 'https://github.com/13Bytes', 'https://github.com/13Bytes/ashby',
    'https://github.com/Aerospace-Lab-e-V/', 'https://www.instagram.com/aerospace_lab/', 'https://www.linkedin.com/company/aerospacelab-herrenberg',
  ]
  for (const file of files) {
    const source = await readFile(path.join(projectDir, file), 'utf8')
    assert.doesNotMatch(source, /@font-face|@import\s+url|fonts\.googleapis|fonts\.gstatic|<link[^>]+href=["']https?:|<script[^>]+src=["']https?:/, file)
    for (const url of source.match(/https?:\/\/[^\s'"`)<>]+/g) ?? []) {
      if (url.startsWith('http://www.w3.org/')) continue
      assert.ok(allowedLinks.includes(url), `${file}: unexpected external URL ${url}`)
    }
  }
})

test('a duplicated tab without sessionStorage joins its workspace from the URL and asks the other tabs for the config', async () => {
  const app = await readSource('App.tsx')

  assert.match(app, /params\.set\(WORKSPACE_URL_PARAM, workspaceId\)/)
  assert.match(app, /if \(startedEmpty && getUrlWorkspaceId\(initialSearch\) === workspaceId\) \{/)
  assert.match(app, /sync\.requestConfig\(\)/)
  assert.match(app, /\(\) => lastSyncedConfigRef\.current, workspaceId\)/)
})

test('every setting marked as changed from its default can be reset with ⭮', async () => {
  const controls = await readSource('components/common/AppControls.tsx')
  assert.match(controls, /if \(level === 'default' && changed && onReset\)/)
  for (const name of await readdir(path.join(projectDir, 'src', 'components', 'settings'))) {
    const source = await readSource(`components/settings/${name}`)
    // a changed={…} expression may span lines (FieldGroup); its onReset follows it
    const marked = source.match(/\bchanged=\{/g)?.length ?? 0
    const resettable = source.match(/\bonReset=\{/g)?.length ?? 0
    assert.equal(resettable, marked, `${name}: ${marked - resettable} changed setting(s) without onReset`)
  }
})
