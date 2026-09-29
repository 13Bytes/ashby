import assert from 'node:assert/strict'
import test from 'node:test'

import { newCondition, operatorsFor, readFilter, withOperator, writeFilter } from '../../src/utils/rowFilter.ts'

test('the filter reads Teable\'s format and writes {} once no condition is left', () => {
  assert.deepEqual(readFilter({}), { conjunction: 'and', filterSet: [] })
  assert.deepEqual(writeFilter(readFilter({})), {})
  const stored = {
    conjunction: 'or',
    filterSet: [
      { fieldId: 'Gruppe', operator: 'isAnyOf', value: ['PC', 'PET'] },
      { conjunction: 'and', filterSet: [{ fieldId: 'Density low', operator: 'isLess', value: 1.3 }] },
    ],
  }
  const group = readFilter(stored)
  assert.equal(group.conjunction, 'or')
  assert.deepEqual(group.filterSet[1], { conjunction: 'and', filterSet: [{ fieldId: 'Density low', operator: 'isLess', value: '1.3' }] })
  // a single condition without a group is kept as the only condition
  assert.deepEqual(readFilter({ fieldId: 'Gruppe', operator: 'is', value: 'PC' }).filterSet, [{ fieldId: 'Gruppe', operator: 'is', value: 'PC' }])
})

test('changing the operator keeps the value where it fits', () => {
  const condition = { ...newCondition('Gruppe'), value: 'PC' }
  assert.deepEqual(withOperator(condition, 'isAnyOf').value, ['PC'])
  assert.equal(withOperator(withOperator(condition, 'isAnyOf'), 'contains').value, 'PC')
  assert.equal(withOperator(condition, 'isEmpty').value, null)
})

test('text and number columns offer their own operators', () => {
  assert.ok(operatorsFor('text').includes('contains'))
  assert.ok(!operatorsFor('text').includes('isGreater'))
  assert.ok(operatorsFor('number').includes('isGreater'))
  assert.ok(operatorsFor(undefined).includes('contains') && operatorsFor(undefined).includes('isGreater'))
})
