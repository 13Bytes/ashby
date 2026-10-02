// Behavioral tests for editing plots and datasets, the data source helpers, the color picker's
// color math and the required-settings status. TypeScript sources are imported directly through
// tests/frontend/register-ts.mjs (see the test:frontend npm script).
import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizePlotConfig } from '../../src/config/configMappers.ts'
import {
  byDataframeIndex,
  dataframeLabel,
  duplicateFrameInDataframe,
  getSelectedIndices,
  getUiKey,
  moveFrameInConfig,
  nextDataframeName,
  positiveValue,
} from '../../src/utils/appState.ts'
import { hexToHsv, hsvToHex, parseHexInput } from '../../src/utils/colors.ts'
import { readDatasourceWithFallback, toMemoryFile } from '../../src/utils/datasourceStorage.ts'
import { getDataframeMissing, getFrameMissing } from '../../src/utils/settingsStatus.ts'

/** Two dataframes: A, B, C (B excluded) and X, Y (all included). */
const twoDataframes = () => {
  const config = normalizePlotConfig({
    dataframes: [
      { frames: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] },
      { frames: [{ name: 'X' }, { name: 'Y' }] },
    ],
  })
  config.dataframes[0].createAllFrames = [0, 2]
  config.dataframes[1].createAllFrames = true
  return config
}
const names = (dataframe) => dataframe.frames.map((frame) => frame.name)
const included = (dataframe) => getSelectedIndices(dataframe.frames.length, dataframe.createAllFrames).map((index) => dataframe.frames[index].name)

test('moving a plot within its dataset reorders it and its include state', () => {
  const result = moveFrameInConfig(twoDataframes(), 0, 0, 0, 2)
  assert.deepEqual(names(result.config.dataframes[0]), ['B', 'A', 'C'])
  assert.deepEqual(included(result.config.dataframes[0]), ['A', 'C'])
  assert.deepEqual(result.position, { dataframeIndex: 0, frameIndex: 1 })
})

test('moving a plot behind the last plot of its dataset', () => {
  const result = moveFrameInConfig(twoDataframes(), 0, 0, 0, 3)
  assert.deepEqual(names(result.config.dataframes[0]), ['B', 'C', 'A'])
  assert.deepEqual(result.position, { dataframeIndex: 0, frameIndex: 2 })
})

test('dropping a plot next to itself changes nothing', () => {
  const config = twoDataframes()
  assert.equal(moveFrameInConfig(config, 0, 1, 0, 1), null)
  assert.equal(moveFrameInConfig(config, 0, 1, 0, 2), null)
  assert.equal(moveFrameInConfig(config, 0, 7, 0, 0), null)
})

test('moving a plot to another dataset keeps its include state', () => {
  const excluded = moveFrameInConfig(twoDataframes(), 0, 1, 1, 1)
  assert.deepEqual(names(excluded.config.dataframes[0]), ['A', 'C'])
  assert.deepEqual(names(excluded.config.dataframes[1]), ['X', 'B', 'Y'])
  assert.deepEqual(included(excluded.config.dataframes[0]), ['A', 'C'])
  assert.deepEqual(included(excluded.config.dataframes[1]), ['X', 'Y'])
  assert.deepEqual(excluded.position, { dataframeIndex: 1, frameIndex: 1 })

  const toEnd = moveFrameInConfig(twoDataframes(), 0, 2, 1, 99)
  assert.deepEqual(names(toEnd.config.dataframes[1]), ['X', 'Y', 'C'])
  assert.deepEqual(included(toEnd.config.dataframes[1]), ['X', 'Y', 'C'])
  assert.deepEqual(toEnd.position, { dataframeIndex: 1, frameIndex: 2 })
})

test('a dataset keeps at least one plot', () => {
  const config = twoDataframes()
  config.dataframes[1].frames = config.dataframes[1].frames.slice(0, 1)
  assert.equal(moveFrameInConfig(config, 1, 0, 0, 0), null)
})

test('moving a plot does not change the original config', () => {
  const config = twoDataframes()
  moveFrameInConfig(config, 0, 0, 1, 0)
  assert.deepEqual(names(config.dataframes[0]), ['A', 'B', 'C'])
  assert.deepEqual(names(config.dataframes[1]), ['X', 'Y'])
})

test('a duplicated plot is an independent copy right after the original with its include state', () => {
  const dataframe = twoDataframes().dataframes[0]
  const result = duplicateFrameInDataframe(dataframe, 1)
  assert.equal(result.frameIndex, 2)
  assert.deepEqual(names(result.dataframe).slice(0, 2), ['A', 'B'])
  assert.equal(result.dataframe.frames.length, 4)
  const copy = result.dataframe.frames[2]
  assert.notEqual(copy.name, 'B')
  assert.notEqual(getUiKey(copy, 'frame'), getUiKey(dataframe.frames[1], 'frame'))
  assert.deepEqual(included(result.dataframe), ['A', 'C'])
  const copyOfIncluded = duplicateFrameInDataframe(dataframe, 0).dataframe
  assert.deepEqual(included(copyOfIncluded), ['A', copyOfIncluded.frames[1].name, 'C'])
  copy.layers[0].name = 'changed'
  assert.notEqual(dataframe.frames[1].layers[0].name, 'changed')
  assert.equal(duplicateFrameInDataframe(dataframe, 5), null)
})

test('new datasets get the next free short name', () => {
  assert.equal(dataframeLabel({ name: '  ' }, 2), 'DF 3')
  assert.equal(nextDataframeName([{ name: 'DF 1' }, { name: '' }]), 'DF 3')
  assert.equal(nextDataframeName([{ name: 'DF 2' }]), 'DF 3')
})

test('the import sheet is a non-negative whole number', () => {
  const sheet = (value) => normalizePlotConfig({ dataframes: [{ import_sheet: value, frames: [{}] }] }).dataframes[0].importSheet
  assert.equal(sheet(-3), 0)
  assert.equal(sheet(2.4), 2)
  assert.equal(sheet(1), 1)
})

test('missing required settings of a dataset depend on its source mode', () => {
  const dataframe = normalizePlotConfig({ dataframes: [{ frames: [{}] }] }).dataframes[0]
  const withAxes = { ...dataframe, axes: [{ ...dataframe.axes[0], name: 'Density', columns: ['density'] }] }
  const sections = (missing) => missing.map((entry) => entry.setting)

  const file = { ...withAxes, _extensions: { source_mode: 'file' }, importFileName: 'mine.xlsx' }
  assert.deepEqual(sections(getDataframeMissing(file, [], false)), ['dataSource'])
  assert.deepEqual(sections(getDataframeMissing(file, [], true)), [])

  const teable = { ...withAxes, _extensions: { source_mode: 'teable' }, teableUrl: 'https://example.invalid', apiKey: undefined }
  assert.deepEqual(sections(getDataframeMissing(teable, [], false)), ['dataSource'])
  assert.deepEqual(sections(getDataframeMissing({ ...teable, apiKey: 'key' }, [], false)), [])

  const noAxisColumns = { ...file, axes: [{ ...withAxes.axes[0], columns: [] }] }
  assert.deepEqual(sections(getDataframeMissing(noAxisColumns, [], true)), ['axes'])
})

test('missing required settings of a plot', () => {
  const frame = normalizePlotConfig({ dataframes: [{ frames: [{}] }] }).dataframes[0].frames[0]
  const empty = { ...frame, xQuantity: '', yQuantity: '', layers: [{ ...frame.layers[0], name: ' ' }] }
  assert.deepEqual(getFrameMissing(empty).map((entry) => entry.setting), ['xAxis', 'yAxis', 'groupMaterialsBy'])
  const complete = { ...empty, xQuantity: 'Density', yQuantity: 'Cost', layers: [{ ...frame.layers[0], name: 'Family' }] }
  assert.deepEqual(getFrameMissing(complete), [])
})

test('color picker converts between hex and HSV without drift', () => {
  for (const hex of ['#000000', '#ffffff', '#4e79a7', '#f28e2b', '#e15759', '#59a14f', '#7f7f7f', '#ff0000', '#00ff00', '#0000ff']) {
    assert.equal(hsvToHex(hexToHsv(hex)), hex)
  }
  assert.deepEqual(hexToHsv('#ff0000'), { h: 0, s: 1, v: 1 })
  assert.equal(hexToHsv('#808080').s, 0)
})

test('typed hex colors are accepted with or without # and as short form', () => {
  assert.equal(parseHexInput('4E79A7'), '#4e79a7')
  assert.equal(parseHexInput(' #abc '), '#aabbcc')
  assert.equal(parseHexInput('#12345'), null)
  assert.equal(parseHexInput('blue'), null)
})

test('a datasource file is copied into memory', async () => {
  const copy = await toMemoryFile(new File(['abc'], 'data.xlsx', { type: 'application/test', lastModified: 5 }), 'renamed.xlsx')
  assert.equal(copy.name, 'renamed.xlsx')
  assert.equal(copy.type, 'application/test')
  assert.equal(copy.lastModified, 5)
  assert.equal(await copy.text(), 'abc')
})

/** A file whose content can no longer be read, like a workbook changed on disk after selecting it. */
const unreadableFile = (name, read = () => Promise.reject(new DOMException('changed on disk', 'NotReadableError'))) => {
  const file = new File(['stale'], name)
  Object.defineProperty(file, 'arrayBuffer', { value: read })
  return file
}

test('an unreadable datasource file falls back to the copy in browser storage', async () => {
  const stored = new File(['from storage'], 'data.xlsx')
  const file = await readDatasourceWithFallback(unreadableFile('data.xlsx'), async () => stored)
  assert.equal(file.name, 'data.xlsx')
  assert.equal(await file.text(), 'from storage')
})

test('an unreadable datasource file without a stored copy reports the original error', async () => {
  await assert.rejects(readDatasourceWithFallback(unreadableFile('data.xlsx'), async () => undefined), { name: 'NotReadableError' })
  await assert.rejects(readDatasourceWithFallback(unreadableFile('data.xlsx'), async () => { throw new Error('no storage') }), { name: 'NotReadableError' })
  await assert.rejects(readDatasourceWithFallback(unreadableFile('data.xlsx'), async () => unreadableFile('data.xlsx')), { name: 'NotReadableError' })
})

test('reading a datasource file that never finishes times out', async () => {
  const hanging = unreadableFile('data.xlsx', () => new Promise(() => {}))
  await assert.rejects(readDatasourceWithFallback(hanging, async () => undefined, 20), /did not finish/)
})

test('the default marker and font size of annotations are filled in and positive', () => {
  const defaultsOf = (annotations) => normalizePlotConfig({ dataframes: [{ frames: [{ annotations }] }] }).dataframes[0].frames[0].annotations[0]
  assert.deepEqual(defaultsOf([]), { markerSize: 330, fontSize: 18 })
  assert.equal(defaultsOf([{}]).markerSize, 330)
  assert.equal(defaultsOf([{ marker_size: -5, font_size: 0 }]).fontSize, 18)
  assert.equal(defaultsOf([{ marker_size: -5 }]).markerSize, 330)
  assert.deepEqual([defaultsOf([{ marker_size: 200, font_size: 12 }]).markerSize, defaultsOf([{ font_size: 12 }]).fontSize], [200, 12])
  const withAnnotation = normalizePlotConfig({ dataframes: [{ frames: [{ annotations: [{ font_size: 9 }, { text: { name: 'PEEK' } }] }] }] }).dataframes[0].frames[0].annotations
  assert.equal(withAnnotation.length, 2)
  assert.equal(withAnnotation[1].text.name, 'PEEK')
})

test('size fields only take numbers greater than 0', () => {
  assert.equal(positiveValue(12, 18), 12)
  assert.equal(positiveValue(-3, 18), 18)
  assert.equal(positiveValue(0, 18), 18)
  assert.equal(positiveValue(Number.NaN, 18), 18)
})

test('per-dataframe state follows its dataframe when dataframes are reordered or removed', () => {
  const files = { 'df-a': 'a.xlsx', 'df-c': 'c.xlsx' }
  assert.deepEqual(byDataframeIndex(['df-a', 'df-b', 'df-c'], files), { 0: 'a.xlsx', 2: 'c.xlsx' })
  assert.deepEqual(byDataframeIndex(['df-c', 'df-a'], files), { 0: 'c.xlsx', 1: 'a.xlsx' })
  assert.deepEqual(byDataframeIndex(['df-b'], files), {})
})

test('renaming an axis ID carries the frames along; an empty or taken ID waits', async () => {
  const { renameAxisInDataframe } = await import('../../src/utils/configEditing.ts')
  const config = normalizePlotConfig({
    dataframes: [{
      axes: [{ name: 'density', columns: [] }, { name: 'price', columns: [] }],
      frames: [{
        x_quantity: 'density', y_quantity: 'price', y_rel_quantity: 'density',
        guidelines: [{ m: 1, plot_axes: ['density', 'price/density'] }],
        annotations: [{ axes: { density: 1, price: 2 } }],
        colored_areas: [{ axes: { density: [0, 1] }, x: [0], y: [0], color: 'red', alpha: 0.2 }],
      }],
    }],
  })
  const df = config.dataframes[0]
  const renamed = renameAxisInDataframe(df, 0, 'rho', 'density')
  const frame = renamed.frames[0]
  assert.equal(renamed.axes[0].name, 'rho')
  assert.deepEqual([frame.xQuantity, frame.yQuantity, frame.yRelQuantity], ['rho', 'price', 'rho'])
  assert.deepEqual(frame.guidelines[0].plotAxes, ['rho', 'price/rho'])
  assert.deepEqual(Object.keys(frame.annotations[0].axes), ['rho', 'price'])
  assert.deepEqual(Object.keys(frame.coloredAreas[0].axes), ['rho'])
  assert.equal(df.frames[0].xQuantity, 'density')     // the original config is unchanged

  // empty for a moment, or the other axis' ID: the frames keep the old ID
  for (const name of ['', 'price']) {
    const waiting = renameAxisInDataframe(df, 0, name, 'density')
    assert.equal(waiting.axes[0].name, name)
    assert.equal(waiting.frames[0].xQuantity, 'density')
  }
})
