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

test('appState UI keys stay stable for reorderable entities and refresh for clones', async () => {
  const { getUiKey, refreshUiKey } = await importTypeScriptModule('src/utils/appState.ts')
  const frame = { _extensions: {} }
  const firstKey = getUiKey(frame, 'frame')

  assert.equal(getUiKey(frame, 'frame'), firstKey)
  refreshUiKey(frame, 'frame')
  assert.notEqual(getUiKey(frame, 'frame'), firstKey)
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
