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

const firstDataframe = (config) => toExternalConfig(normalizePlotConfig(config)).dataframes[0]

test('legend position is a dataframe setting: right, above, or none (null)', () => {
  assert.equal(firstDataframe({ dataframes: [{ frames: [{}] }] }).legend_above, false)
  assert.equal(firstDataframe({ dataframes: [{ legend_above: true, frames: [{}] }] }).legend_above, true)
  assert.equal(firstDataframe({ dataframes: [{ legend_above: null, frames: [{}] }] }).legend_above, null)
  const frame = firstFrame({ dataframes: [{ frames: [{ legend_above: true, legend_flag: true }] }] })
  assert.equal('legend_above' in frame || 'legend_flag' in frame, false)
})

test('configs before version 6: the legend position and dark mode of the first frame move to the dataframe', () => {
  assert.equal(firstDataframe({ version: 5, dataframes: [{ frames: [{ legend_above: null }, { legend_above: true }] }] }).legend_above, null)
  assert.equal(firstDataframe({ version: 5, dataframes: [{ frames: [{ legend_above: true }] }] }).legend_above, true)
  // The dataframe's own values win.
  assert.equal(firstDataframe({ dataframes: [{ legend_above: false, frames: [{ legend_above: true }] }] }).legend_above, false)
  assert.equal(firstDataframe({ dataframes: [{ frames: [{ dark_mode: true }] }] }).dark_mode, true)
  assert.equal(firstDataframe({ dataframes: [{ dark_mode: false, frames: [{ dark_mode: true }] }] }).dark_mode, false)
  assert.equal('dark_mode' in firstFrame({ dataframes: [{ frames: [{ dark_mode: true }] }] }), false)
})

test('guideline label direction and annotation settings survive import and export', () => {
  const frame = firstFrame({
    dataframes: [{
      frames: [{
        guidelines: [{ x: 1, y: 2, label_rotated: false }, { x: 1 }],
        annotations: [{}, { text: { name: 'A', font_size: 12 }, axes: {}, marker: { edgecolor: 'red' } }],
      }],
    }],
  })
  assert.deepEqual(frame.guidelines.map((guideline) => guideline.label_rotated), [false, true])
  assert.equal(frame.annotations[1].text.font_size, 12)
  assert.equal(frame.annotations[1].marker.edgecolors, 'red')
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
    { code: 'incomplete_quantities', count: 3, quantities: [{ name: 'Strength', missing: ['high'] }] },
    { code: 'non_numeric_values', count: 1, columns: [{ column: 'Density low', count: 2, example: 'n/a' }] },
    { code: 'padded_names', count: 1, columns: [' low'] },
    { code: 'from_a_newer_backend' },
    null,
  ])
  assert.equal(warnings.length, 2)
  const [incomplete, nonNumeric] = warnings.map((warning) => describeFormatWarning(warning, t))
  assert.match(incomplete, /Strength \(missing: high\), and 2 more/)
  assert.match(nonNumeric, /Density low \(2× e\.g\. "n\/a"\)/)
  assert.deepEqual(parseFormatWarnings(undefined), [])
})

test('axis margin: each side a relative margin or a fixed value on the axis', () => {
  const exported = (frame) => firstFrame({ dataframes: [{ frames: [frame] }] })
  assert.deepEqual(exported({ axis_margin: { left: { absolute: 5 }, right: 0.2, top: 0.1, bottom: 0, plot_axes: ['tens', 'hdt'] } }).axis_margin,
    { left: { absolute: 5 }, right: 0.2, bottom: 0, top: 0.1, plot_axes: ['tens', 'hdt'] })
  // One number sets all sides; the axes are only noted for fixed values.
  assert.deepEqual(exported({ axis_margin: 0.05 }).axis_margin, { left: 0.05, right: 0.05, bottom: 0.05, top: 0.05 })
  assert.equal('x_lim' in exported({}), false)
})

test('configs before version 6: automatic_Display_Area_margin and x_lim/y_lim become axis_margin', () => {
  const frame = firstFrame({ version: 5, dataframes: [{ frames: [{ automatic_Display_Area_margin: 0.05, x_lim: [0, null], y_lim: [1, 1000] }] }] })
  assert.deepEqual(frame.axis_margin, { left: { absolute: 0 }, right: 0.05, bottom: { absolute: 1 }, top: { absolute: 1000 } })
  assert.equal('automatic_Display_Area_margin' in frame, false)
  // The automatic area was switched off (null) for fixed limits: the other sides get the default margin.
  assert.deepEqual(firstFrame({ dataframes: [{ frames: [{ automatic_Display_Area_margin: null, x_lim: [2, 3] }] }] }).axis_margin,
    { left: { absolute: 2 }, right: { absolute: 3 }, bottom: 0.12, top: 0.12 })
})

test('guidelines and polygon areas keep the axes their coordinates were entered for', () => {
  const frame = firstFrame({ dataframes: [{ frames: [{
    guidelines: [{ x: 1, y: 2, plot_axes: ['tens', 'hdt'] }, { x: 1 }],
    colored_areas: [{ x: [0, 1, 1], y: [0, 0, 1], plot_axes: ['tens', 'hdt'] }, { axes: { tens: [1, 2] }, x: [], y: [], plot_axes: ['tens', 'hdt'] }],
  }] }] })
  assert.deepEqual(frame.guidelines.map((guideline) => guideline.plot_axes), [['tens', 'hdt'], undefined])
  // Axis ranges belong to named axes: no note needed.
  assert.deepEqual(frame.colored_areas.map((area) => area.plot_axes), [['tens', 'hdt'], undefined])
  assert.equal('plotAxes' in frame.colored_areas[0], false)
})
