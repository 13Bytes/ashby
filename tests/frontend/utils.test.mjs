// Behavioral tests for the frontend's pure modules. TypeScript sources are imported directly
// through tests/frontend/register-ts.mjs (see the test:frontend npm script).
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizePlotConfig } from '../../src/config/configMappers.ts'
import { createDefaultPlotConfig } from '../../src/config/defaultPlotConfig.ts'
import {
  ensureUiKeys,
  getAxisBasesFromColumns,
  getSelectedIndices,
  getSourceMode,
  getUiKey,
  insertSelectionIndex,
  refreshUiKey,
  removeSelectionIndex,
  reorderSelectionIndices,
  toggleIndexSelection,
} from '../../src/utils/appState.ts'
import { addColoredAreaToFrame, parseNumberList, parseStrictNumberList, toCommaList } from '../../src/utils/coloredAreas.ts'
import { addAnnotationToFrame, generateMaterialColorsForDataframe, getLocalizedLabel, setLocalizedLabel } from '../../src/utils/configEditing.ts'
import { findExternalFrameOffset, parseImportedConfig, parseJsonField, toExternalConfig } from '../../src/utils/configIo.ts'
import { getJsonSyntaxMarkers } from '../../src/utils/jsonHighlight.ts'
import { addPlotLanguageToList, normalizePlotLanguages } from '../../src/utils/plotLanguages.ts'
import { createConfigSync, getWorkspaceId } from '../../src/utils/tabSync.ts'
import { parseUIThemePreference, resolveUITheme } from '../../src/utils/uiTheme.ts'
import { parseUILanguage, translate, UI_LABELS } from '../../src/uiTranslations.ts'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(projectDir, relativePath), 'utf8'))
/** Export → JSON → import, like sessionStorage, tab sync and config files do. */
const roundTrip = (config) => normalizePlotConfig(JSON.parse(JSON.stringify(toExternalConfig(config))))
const exported = (config) => JSON.parse(JSON.stringify(toExternalConfig(config)))

test('appState derives axis bases only from complete low/high/unit column groups', () => {
  assert.deepEqual(
    getAxisBasesFromColumns(['Density high', 'Density unit', 'Density low', 'Cost low', 'Cost high']),
    ['Density'],
  )
})

test('appState keeps selected indices in sync when inserting, removing, and reordering', () => {
  assert.deepEqual(getSelectedIndices(4, true), [0, 1, 2, 3])
  assert.deepEqual(toggleIndexSelection(3, true, 1, false), [0, 2])
  assert.deepEqual(insertSelectionIndex(4, [0, 2], 1), [0, 3])
  assert.deepEqual(removeSelectionIndex(3, [0, 2], 0), [1])
  assert.deepEqual(reorderSelectionIndices(4, [0, 3], 3, 1), [0, 1])
})

test('jsonHighlight marks malformed brackets and unterminated strings', () => {
  const draft = '{"label":"<unsafe>",]'
  const markers = getJsonSyntaxMarkers(draft)

  assert.equal(markers.has(draft.indexOf('{')), true)
  assert.equal(markers.has(draft.indexOf(']')), true)
  assert.equal(getJsonSyntaxMarkers('{"label":"unterminated}').has(9), true)
})

test('plot language helpers trim, dedupe, and preserve at least one language', () => {
  assert.deepEqual(normalizePlotLanguages(['en'], [' de ', 'de', '']), ['de'])
  assert.deepEqual(normalizePlotLanguages(['en'], ['  ']), ['en'])
  assert.deepEqual(addPlotLanguageToList(['en'], ' de '), ['en', 'de'])
  assert.deepEqual(addPlotLanguageToList(['en'], 'en'), ['en'])
})

test('colored area helpers parse numbers and append a default area', () => {
  assert.deepEqual(parseNumberList('1, 2, nope, 3.5'), [1, 2, 3.5])
  assert.equal(toCommaList([1, 2, 3]), '1, 2, 3')
  assert.deepEqual(addColoredAreaToFrame({ coloredAreas: [] }).coloredAreas[0], { x: [0, 1], y: [0, 1], color: '#ef4444', alpha: 0.2 })
})

test('strict number list parsing rejects incomplete input while typing', () => {
  assert.deepEqual(parseStrictNumberList(''), [])
  assert.deepEqual(parseStrictNumberList('1, 2.5, -3'), [1, 2.5, -3])
  assert.equal(parseStrictNumberList('1,'), undefined)
  assert.equal(parseStrictNumberList('1, -'), undefined)
})

test('JSON editor fields accept objects and reject partial input', () => {
  assert.deepEqual(parseJsonField('', {}), {})
  assert.deepEqual(parseJsonField('{"a": 1}', {}), { a: 1 })
  assert.equal(parseJsonField('{"a": ', {}), undefined)
  assert.equal(parseJsonField('42', {}), undefined)
})

test('JSONC comment stripping keeps comment-like text inside strings', () => {
  const text = '{\n  // comment\n  "url": "https://example.invalid/a//b", /* block */\n  "glob": "dir/*.xlsx",\n  "quote": "say \\"//hi\\""\n}'

  assert.deepEqual(parseImportedConfig(text), { url: 'https://example.invalid/a//b', glob: 'dir/*.xlsx', quote: 'say "//hi"' })
})

test('UI keys stay stable, refresh for clones, and are unique per config', () => {
  const frame = { _extensions: {} }
  const firstKey = getUiKey(frame, 'frame')
  assert.equal(getUiKey(frame, 'frame'), firstKey)
  refreshUiKey(frame, 'frame')
  assert.notEqual(getUiKey(frame, 'frame'), firstKey)

  // A stored key like "dataframe-1" must not collide with keys created after a reload.
  const config = createDefaultPlotConfig()
  config.dataframes[0]._extensions.uiKey = 'dataframe-1'
  config.dataframes.push(structuredClone(config.dataframes[0]))
  ensureUiKeys(config)
  const keys = config.dataframes.map((dataframe) => dataframe._extensions.uiKey)
  assert.equal(new Set(keys).size, 2)
  assert.equal(keys[0], 'dataframe-1')
})

test('normalizePlotConfig assigns UI keys to every dataframe and frame', () => {
  const config = normalizePlotConfig()
  assert.equal(typeof config.dataframes[0]._extensions.uiKey, 'string')
  assert.equal(typeof config.dataframes[0].frames[0]._extensions.uiKey, 'string')
})

test('source mode comes from explicit metadata, then Teable settings, then the dataset catalog', () => {
  assert.equal(getSourceMode({ _extensions: { source_mode: 'dataset' } }), 'dataset')
  assert.equal(getSourceMode({ _extensions: {}, importFileName: 'dataset_1.xlsx' }, ['dataset_1.xlsx']), 'dataset')
  assert.equal(getSourceMode({ _extensions: {}, teableUrl: 'https://example.invalid' }, []), 'teable')
  assert.equal(getSourceMode({ _extensions: {}, importFileName: 'mine.xlsx' }, ['dataset_1.xlsx']), 'file')
})

test('uiTheme validates stored values and resolves system preference', () => {
  assert.equal(parseUIThemePreference('dark'), 'dark')
  assert.equal(parseUIThemePreference('invalid'), 'system')
  assert.equal(parseUIThemePreference(null), 'system')
  assert.equal(resolveUITheme('system', true), 'dark')
  assert.equal(resolveUITheme('system', false), 'light')
  assert.equal(resolveUITheme('light', true), 'light')
  assert.equal(resolveUITheme('dark', false), 'dark')
})

test('translations fill placeholders and cover every key in every language', () => {
  assert.equal(translate('en', 'batchProgress', { current: 2, total: 5 }), '2 of 5 plots created')
  assert.equal(translate('de', 'batchProgress', { current: 2, total: 5 }), '2 von 5 Plots erstellt')
  assert.equal(translate('en', 'positionOn', {}), 'Position on {axis}')
  assert.deepEqual(Object.keys(UI_LABELS.de).sort(), Object.keys(UI_LABELS.en).sort())
  assert.equal(parseUILanguage('de'), 'de')
  assert.equal(parseUILanguage('fr'), 'en')
})

test('frames inherit dataframe dark mode unless explicitly overridden', () => {
  const config = createDefaultPlotConfig()
  config.dataframes[0].darkMode = true

  const inherited = exported(config)
  assert.equal(inherited.dataframes[0].dark_mode, true)
  assert.equal('dark_mode' in inherited.dataframes[0].frames[0], false)

  config.dataframes[0].frames[0].darkMode = false
  assert.equal(exported(config).dataframes[0].frames[0].dark_mode, false)
  assert.equal(roundTrip(config).dataframes[0].frames[0].darkMode, false)
})

test('the export uses the backend key names', () => {
  const config = createDefaultPlotConfig()
  config.dataframes[0]._extensions.source_mode = 'dataset'
  Object.assign(config.dataframes[0].font, { tickSize: 7, legendTitleSize: 21 })
  const [dataframe] = exported(config).dataframes

  assert.equal(dataframe._extensions.source_mode, 'dataset')
  assert.equal(dataframe.font.tick_size, 7)
  assert.equal(dataframe.font.legend_title_size, 21)
  // Layers without a column name must not send an empty name to the backend.
  assert.equal('name' in dataframe.frames[0].layers[0], false)
})

test('backend-format nested objects are imported into the editor model', () => {
  const config = normalizePlotConfig({
    dataframes: [{
      import_file_name: 'data.xlsx',
      frames: [{
        layers: [{ name: 'Material', alpha_points: 0.3 }],
        guidelines: [{ line_props: { color: 'red' }, label: { en: 'a', de: 'b' } }],
        annotations: [{ marker_size: 100 }, { marker: { marker_symbol: 's' } }],
      }],
    }],
  })
  const [dataframe] = config.dataframes
  const [frame] = dataframe.frames

  assert.equal(dataframe.excelImport, true)
  assert.equal(frame.layers[0].alphaPoints, 0.3)
  assert.equal(frame.guidelines[0].lineProps.color, 'red')
  assert.deepEqual(frame.guidelines[0].label, { en: 'a', de: 'b' })
  assert.equal(frame.annotations[1].marker.markerSymbol, 's')
})

test('dataframe settings survive export and import', () => {
  const config = createDefaultPlotConfig()
  const [dataframe] = config.dataframes
  Object.assign(dataframe, { transparent: true, watermark: 'logo.png', copyright: false, fileformat: 'png', resolution: 250 })
  dataframe.frames[0].xLim = [1, undefined]
  dataframe.frames[0].yLim = [undefined, 5]

  const [imported] = roundTrip(config).dataframes
  assert.equal(imported.transparent, true)
  assert.equal(imported.watermark, 'logo.png')
  assert.equal(imported.copyright, false)
  assert.equal(imported.fileformat, 'png')
  assert.equal(imported.resolution, 250)
  assert.deepEqual(imported.frames[0].xLim, [1, undefined])
  assert.deepEqual(imported.frames[0].yLim, [undefined, 5])
  assert.equal('transparent' in imported._extensions, false)
})

test('the file format is encoded the way the backend reads it', () => {
  const config = createDefaultPlotConfig()
  config.dataframes[0].fileformat = 'svg'
  assert.equal(exported(config).dataframes[0].resolution, 'svg')
  assert.equal(roundTrip(config).dataframes[0].fileformat, 'svg')

  config.dataframes[0].fileformat = 'png'
  config.dataframes[0].resolution = 300
  assert.equal(exported(config).dataframes[0].resolution, 300)

  // Configs written for the backend only carry `resolution`.
  assert.equal(normalizePlotConfig({ dataframes: [{ resolution: 'svg' }] }).dataframes[0].fileformat, 'svg')
  assert.equal(normalizePlotConfig({ dataframes: [{ resolution: 600 }] }).dataframes[0].fileformat, 'png')
})

test('alpha_points/alpha_areas are exported on named last layers', () => {
  const config = createDefaultPlotConfig()
  Object.assign(config.dataframes[0].frames[0].layers[0], { name: 'Material', alphaPoints: 0.5, alphaAreas: 0.2 })

  const [layer] = exported(config).dataframes[0].frames[0].layers
  assert.equal(layer.alpha_points, 0.5)
  assert.equal(layer.alpha_areas, 0.2)
})

test('root _extensions do not nest on repeated imports', () => {
  let config = normalizePlotConfig({ _extensions: { note: 'x' }, dataframes: [{}] })
  for (let i = 0; i < 3; i += 1) config = roundTrip(config)
  assert.deepEqual(config._extensions, { note: 'x' })
})

test('example configs are stable after the first normalization', async () => {
  for (const file of ['examples/spritzguss-showcase.json', 'examples/axen.json', 'tests/fixtures/render-config.json']) {
    const once = roundTrip(normalizePlotConfig(await readJson(file)))
    assert.deepEqual(exported(roundTrip(once)), exported(once), file)
  }
})

test('findExternalFrameOffset points at the frame inside the exported JSON', () => {
  const config = createDefaultPlotConfig()
  config.dataframes[0].frames.push({ ...structuredClone(config.dataframes[0].frames[0]), name: 'Second' })
  const draft = JSON.stringify(toExternalConfig(config), null, 2)

  const offset = findExternalFrameOffset(config, 0, 1)
  assert.ok(offset > 0)
  assert.match(draft.slice(offset), /^\{\s*"name": "Second"/)
  assert.equal(findExternalFrameOffset(config, 0, 5), -1)
})

test('localized guideline labels keep every plot language', () => {
  assert.equal(getLocalizedLabel('plain', 'de'), 'plain')
  assert.deepEqual(setLocalizedLabel('plain', 'de', 'Linie', ['en', 'de']), { en: 'plain', de: 'Linie' })
  assert.deepEqual(setLocalizedLabel({ en: 'line', fr: 'ligne' }, 'de', 'Linie', ['en', 'de']), { en: 'line', fr: 'ligne', de: 'Linie' })
})

test('adding an annotation keeps annotations[0] as the defaults entry', () => {
  const frame = addAnnotationToFrame({ annotations: [] })
  assert.equal(frame.annotations.length, 2)
  assert.equal(frame.annotations[0].text, undefined)
  assert.equal(typeof frame.annotations[1].text.name, 'string')
})

test('generated material colors keep the default color and the key order', () => {
  const dataframe = { materialColors: { default: '#123456', PA: '#000000', PC: '#000000' } }
  const { materialColors } = generateMaterialColorsForDataframe(dataframe)

  assert.deepEqual(Object.keys(materialColors), ['default', 'PA', 'PC'])
  assert.equal(materialColors.default, '#123456')
  assert.notEqual(materialColors.PA, materialColors.PC)
  assert.match(materialColors.PA, /^#[0-9a-f]{6}$/)
})

test('the workspace id is created once and then reused', () => {
  const store = new Map()
  const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) }
  const id = getWorkspaceId(storage)
  assert.equal(getWorkspaceId(storage), id)
})

test('config sync only delivers messages from other tabs of the same workspace', () => {
  // A fake BroadcastChannel: every channel sees every message, like tabs of one origin.
  const channels = []
  const createChannel = () => {
    const channel = {
      onmessage: null,
      postMessage: (data) => channels.filter((other) => other !== channel).forEach((other) => other.onmessage?.({ data })),
      close: () => channels.splice(channels.indexOf(channel), 1),
    }
    channels.push(channel)
    return channel
  }
  const received = { a: [], b: [], other: [] }
  const a = createConfigSync((config) => received.a.push(config), 'workspace-1', createChannel)
  createConfigSync((config) => received.b.push(config), 'workspace-1', createChannel)
  createConfigSync((config) => received.other.push(config), 'workspace-2', createChannel)

  a.publish('{"version":1}')
  assert.deepEqual(received, { a: [], b: ['{"version":1}'], other: [] })

  a.close()
  assert.equal(channels.length, 2)
})

test('config sync is a no-op without BroadcastChannel support', () => {
  const sync = createConfigSync(() => assert.fail('no messages expected'), 'workspace-1', () => null)
  sync.publish('{}')
  sync.close()
})
