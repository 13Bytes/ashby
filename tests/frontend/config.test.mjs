// Tests for the config format: version, settings from backend/docs/config_explanation.jsonc that
// the editor covers, the preset parsers, Simple mode's hidden sections and the Excel format warnings.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { getConfigVersion, normalizePlotConfig } from '../../src/config/configMappers.ts'
import { CONFIG_VERSION } from '../../src/config/defaultPlotConfig.ts'
import { isHiddenInMode } from '../../src/config/settingsSections.ts'
import { createTranslator } from '../../src/uiTranslations.ts'
import { formatAspectRatio, isSameAspectRatio, parseAspectRatio, parsePositiveInteger } from '../../src/utils/appState.ts'
import { toExternalConfig } from '../../src/utils/configIo.ts'
import { describeFormatWarning, parseFormatWarnings } from '../../src/utils/excelFormat.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const firstFrame = (config) => toExternalConfig(normalizePlotConfig(config)).dataframes[0].frames[0]

test('the frontend and the backend use the same config version', async () => {
  const backend = await readFile(path.join(root, 'backend/import_data/import_json.py'), 'utf8')
  assert.equal(Number(backend.match(/^CURRENT_VERSION\s*=\s*(\d+)/m)?.[1]), CONFIG_VERSION)
})

test('an imported config of another version is read and exported in the current version', () => {
  assert.equal(getConfigVersion({ version: 4 }), 4)
  assert.equal(getConfigVersion({ dataframes: [] }), undefined)
  assert.equal(getConfigVersion({ version: '5' }), undefined)
  assert.equal(normalizePlotConfig({ version: 3 }).version, CONFIG_VERSION)
  assert.equal(toExternalConfig(normalizePlotConfig({ version: 3 })).version, CONFIG_VERSION)
  assert.equal(normalizePlotConfig().version, CONFIG_VERSION)
})

test('legend position: right, above, or none (null), also without room for the legend', () => {
  assert.deepEqual([firstFrame({ dataframes: [{ frames: [{}] }] }).legend_above, firstFrame({ dataframes: [{ frames: [{}] }] }).legend_flag], [false, true])
  assert.equal(firstFrame({ dataframes: [{ frames: [{ legend_above: true }] }] }).legend_above, true)
  const none = firstFrame({ dataframes: [{ frames: [{ legend_above: null }] }] })
  assert.deepEqual([none.legend_above, none.legend_flag], [null, null])
})

test('frame dark mode, guideline label direction and annotation settings survive import and export', () => {
  const frame = firstFrame({
    dataframes: [{
      frames: [{
        dark_mode: true,
        guidelines: [{ x: 1, y: 2, label_rotated: false }, { x: 1 }],
        annotations: [{}, { text: { name: 'A', font_size: 12 }, axes: {}, marker: { edgecolor: 'red' } }],
      }],
    }],
  })
  assert.equal(frame.dark_mode, true)
  assert.deepEqual(frame.guidelines.map((guideline) => guideline.label_rotated), [false, true])
  assert.equal(frame.annotations[1].text.font_size, 12)
  assert.equal(frame.annotations[1].marker.edgecolors, 'red')
  assert.equal('dark_mode' in firstFrame({ dataframes: [{ frames: [{}] }] }), false)
})

test('copyright text and watermark file are kept', () => {
  const dataframe = toExternalConfig(normalizePlotConfig({ dataframes: [{ copyright: '© Lab', watermark: 'logo.png' }] })).dataframes[0]
  assert.deepEqual([dataframe.copyright, dataframe.watermark], ['© Lab', 'logo.png'])
})

test('aspect ratio and resolution presets parse typed values', () => {
  assert.deepEqual(parseAspectRatio('16:9'), [16, 9])
  assert.deepEqual(parseAspectRatio(' 21 / 9 '), [21, 9])
  assert.deepEqual(parseAspectRatio('4x3'), [4, 3])
  assert.deepEqual(parseAspectRatio('1,5'), [1.5, 1])
  for (const invalid of ['', '16:', ':9', '0:1', '-3:2', 'abc', '1:2:3']) assert.equal(parseAspectRatio(invalid), undefined, invalid)
  assert.equal(formatAspectRatio([3, 2]), '3:2')
  assert.ok(isSameAspectRatio([6, 4], [3, 2]))
  assert.ok(!isSameAspectRatio([16, 9], [3, 2]))
  assert.equal(parsePositiveInteger('300'), 300)
  for (const invalid of ['', '0', '-100', '1.5', 'dpi']) assert.equal(parsePositiveInteger(invalid), undefined, invalid)
})

test('Simple mode hides the Text & look section only', () => {
  assert.ok(isHiddenInMode('textLook', 'simple'))
  assert.ok(!isHiddenInMode('textLook', 'all'))
  assert.ok(!isHiddenInMode('data', 'simple'))
})

test('Excel format warnings from the backend are described; unknown ones are left out', () => {
  const t = createTranslator('en')
  const warnings = parseFormatWarnings([
    { code: 'incomplete_quantities', count: 3, quantities: [{ name: 'Strength', missing: ['unit'] }] },
    { code: 'non_numeric_values', count: 1, columns: [{ column: 'Density low', count: 2, example: '1,1' }] },
    { code: 'padded_names', count: 1, columns: [' low'] },
    { code: 'from_a_newer_backend' },
    null,
  ])
  assert.equal(warnings.length, 3)
  const [incomplete, nonNumeric, padded] = warnings.map((warning) => describeFormatWarning(warning, t))
  assert.match(incomplete, /Strength \(missing: unit\), and 2 more/)
  assert.match(nonNumeric, /Density low \(2× e\.g\. "1,1"\)/)
  assert.match(padded, /" low"/)
  assert.deepEqual(parseFormatWarnings(undefined), [])
})
