import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(__dirname, '..', '..')

async function importTypeScriptModule(relativePath) {
  const source = await readFile(path.join(projectDir, relativePath), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

test('appState derives axis bases only from complete low/high/unit column groups', async () => {
  const { getAxisBasesFromColumns } = await importTypeScriptModule('src/utils/appState.ts')

  assert.deepEqual(
    getAxisBasesFromColumns(['Density high', 'Density unit', 'Density low', 'Cost low', 'Cost high']),
    ['Density'],
  )
})

test('appState keeps selected indices in sync when inserting, removing, and reordering', async () => {
  const {
    getSelectedIndices,
    insertSelectionIndex,
    removeSelectionIndex,
    reorderSelectionIndices,
    toggleIndexSelection,
  } = await importTypeScriptModule('src/utils/appState.ts')

  assert.deepEqual(getSelectedIndices(4, true), [0, 1, 2, 3])
  assert.deepEqual(toggleIndexSelection(3, true, 1, false), [0, 2])
  assert.deepEqual(insertSelectionIndex(4, [0, 2], 1), [0, 3])
  assert.deepEqual(removeSelectionIndex(3, [0, 2], 0), [1])
  assert.deepEqual(reorderSelectionIndices(4, [0, 3], 3, 1), [0, 1])
})

test('jsonHighlight marks malformed brackets and unterminated strings', async () => {
  const { getJsonSyntaxMarkers } = await importTypeScriptModule('src/utils/jsonHighlight.ts')
  const draft = '{"label":"<unsafe>",]'
  const markers = getJsonSyntaxMarkers(draft)

  assert.equal(markers.has(draft.indexOf('{')), true)
  assert.equal(markers.has(draft.indexOf(']')), true)
  assert.equal(getJsonSyntaxMarkers('{"label":"unterminated}').has(9), true)
})

test('plot language helpers trim, dedupe, and preserve at least one language', async () => {
  const { addPlotLanguageToList, normalizePlotLanguages } = await importTypeScriptModule('src/utils/plotLanguages.ts')

  assert.deepEqual(normalizePlotLanguages(['en'], [' de ', 'de', '']), ['de'])
  assert.deepEqual(normalizePlotLanguages(['en'], ['  ']), ['en'])
  assert.deepEqual(addPlotLanguageToList(['en'], ' de '), ['en', 'de'])
  assert.deepEqual(addPlotLanguageToList(['en'], 'en'), ['en'])
})


test('colored area helpers parse numbers and append a default area', async () => {
  const { addColoredAreaToFrame, parseNumberList, toCommaList } = await importTypeScriptModule('src/utils/coloredAreas.ts')
  const frame = { coloredAreas: [] }

  assert.deepEqual(parseNumberList('1, 2, nope, 3.5'), [1, 2, 3.5])
  assert.equal(toCommaList([1, 2, 3]), '1, 2, 3')
  assert.deepEqual(addColoredAreaToFrame(frame).coloredAreas[0], { x: [0, 1], y: [0, 1], color: '#ef4444', alpha: 0.2 })
})

test('strict number list parsing rejects incomplete input while typing', async () => {
  const { parseStrictNumberList } = await importTypeScriptModule('src/utils/coloredAreas.ts')

  assert.deepEqual(parseStrictNumberList(''), [])
  assert.deepEqual(parseStrictNumberList('1, 2.5, -3'), [1, 2.5, -3])
  assert.equal(parseStrictNumberList('1,'), undefined)
  assert.equal(parseStrictNumberList('1, -'), undefined)
})

test('JSONC comment stripping keeps comment-like text inside strings', async () => {
  const { parseImportedConfig } = await importTypeScriptModule('src/utils/configIo.ts')
  const text = '{\n  // comment\n  "url": "https://example.invalid/a//b", /* block */\n  "glob": "dir/*.xlsx",\n  "quote": "say \\"//hi\\""\n}'

  assert.deepEqual(parseImportedConfig(text), { url: 'https://example.invalid/a//b', glob: 'dir/*.xlsx', quote: 'say "//hi"' })
})

test('toExternalConfig encodes the file format the way the backend reads it', async () => {
  const { createDefaultPlotConfig } = await importTypeScriptModule('src/config/defaultPlotConfig.ts')
  const { toExternalConfig } = await importTypeScriptModule('src/utils/configIo.ts')
  const config = createDefaultPlotConfig()

  config.dataframes[0].fileformat = 'svg'
  assert.equal(toExternalConfig(config).dataframes[0].resolution, 'svg')
  config.dataframes[0].fileformat = 'png'
  config.dataframes[0].resolution = 300
  assert.equal(toExternalConfig(config).dataframes[0].resolution, 300)
})

test('toExternalConfig keeps alpha_points/alpha_areas on named last layers', async () => {
  const { createDefaultPlotConfig } = await importTypeScriptModule('src/config/defaultPlotConfig.ts')
  const { toExternalConfig } = await importTypeScriptModule('src/utils/configIo.ts')
  const config = createDefaultPlotConfig()
  Object.assign(config.dataframes[0].frames[0].layers[0], { name: 'Material', alphaPoints: 0.5, alphaAreas: 0.2 })

  const [layer] = toExternalConfig(config).dataframes[0].frames[0].layers
  assert.equal(layer.alpha_points, 0.5)
  assert.equal(layer.alpha_areas, 0.2)
})

test('findExternalFrameOffset points at the frame inside the exported JSON', async () => {
  const { createDefaultPlotConfig } = await importTypeScriptModule('src/config/defaultPlotConfig.ts')
  const { findExternalFrameOffset, toExternalConfig } = await importTypeScriptModule('src/utils/configIo.ts')
  const config = createDefaultPlotConfig()
  config.dataframes[0].frames.push({ ...structuredClone(config.dataframes[0].frames[0]), name: 'Second' })
  const draft = JSON.stringify(toExternalConfig(config), null, 2)

  const offset = findExternalFrameOffset(config, 0, 1)
  assert.ok(offset > 0)
  assert.match(draft.slice(offset), /^\{\s*"name": "Second"/)
  assert.equal(findExternalFrameOffset(config, 0, 5), -1)
})

test('localized guideline labels keep every plot language', async () => {
  const { getLocalizedLabel, setLocalizedLabel } = await importTypeScriptModule('src/utils/configEditing.ts')

  assert.equal(getLocalizedLabel('plain', 'de'), 'plain')
  assert.deepEqual(setLocalizedLabel('plain', 'de', 'Linie', ['en', 'de']), { en: 'plain', de: 'Linie' })
  assert.deepEqual(setLocalizedLabel({ en: 'line', fr: 'ligne' }, 'de', 'Linie', ['en', 'de']), { en: 'line', fr: 'ligne', de: 'Linie' })
})

test('appState UI keys stay stable for reorderable entities and refresh for clones', async () => {
  const { getUiKey, refreshUiKey } = await importTypeScriptModule('src/utils/appState.ts')
  const frame = { _extensions: {} }
  const firstKey = getUiKey(frame, 'frame')

  assert.equal(getUiKey(frame, 'frame'), firstKey)
  refreshUiKey(frame, 'frame')
  assert.notEqual(getUiKey(frame, 'frame'), firstKey)
})

test('appState resolves dataset source mode from explicit metadata and server catalogs', async () => {
  const { getSourceMode } = await importTypeScriptModule('src/utils/appState.ts')

  assert.equal(getSourceMode({ _extensions: { source_mode: 'dataset' }, teableUrl: undefined, apiKey: undefined, importFileName: undefined }), 'dataset')
  assert.equal(getSourceMode({ _extensions: {}, teableUrl: undefined, apiKey: undefined, importFileName: 'dataset_1.xlsx' }, ['dataset_1.xlsx']), 'dataset')
  assert.equal(getSourceMode({ _extensions: {}, teableUrl: 'https://example.invalid', apiKey: undefined, importFileName: undefined }, []), 'teable')
})

test('uiTheme validates stored values and resolves system preference', async () => {
  const { parseUIThemePreference, resolveUITheme } = await importTypeScriptModule('src/utils/uiTheme.ts')

  assert.equal(parseUIThemePreference('dark'), 'dark')
  assert.equal(parseUIThemePreference('invalid'), 'system')
  assert.equal(parseUIThemePreference(null), 'system')
  assert.equal(resolveUITheme('system', true), 'dark')
  assert.equal(resolveUITheme('system', false), 'light')
  assert.equal(resolveUITheme('light', true), 'light')
  assert.equal(resolveUITheme('dark', false), 'dark')
})

test('new plot config frames inherit dataframe dark mode unless explicitly overridden', async () => {
  const { createDefaultPlotConfig } = await importTypeScriptModule('src/config/defaultPlotConfig.ts')
  const { toExternalConfig } = await importTypeScriptModule('src/utils/configIo.ts')
  const config = createDefaultPlotConfig()
  config.dataframes[0].darkMode = true

  const inherited = toExternalConfig(config)
  assert.equal(inherited.dataframes[0].dark_mode, true)
  assert.equal('dark_mode' in inherited.dataframes[0].frames[0], false)

  config.dataframes[0].frames[0].darkMode = false
  const overridden = toExternalConfig(config)
  assert.equal(overridden.dataframes[0].frames[0].dark_mode, false)
})

test('toExternalConfig preserves dataframe source mode metadata in _extensions', async () => {
  const { createDefaultPlotConfig } = await importTypeScriptModule('src/config/defaultPlotConfig.ts')
  const { toExternalConfig } = await importTypeScriptModule('src/utils/configIo.ts')
  const config = createDefaultPlotConfig()
  config.dataframes[0]._extensions.source_mode = 'dataset'

  const external = toExternalConfig(config)

  assert.equal(external.dataframes[0]._extensions.source_mode, 'dataset')
})
