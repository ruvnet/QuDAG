const assert = require('assert')

const pgtypes = require('../lib/pg_types')
const { types } = pgtypes

const samples = require('./samples')

describe('sample coverage', () => {
  it('all implemented types should be tested both for NULL and not NULL values', async () => {
    for (const k in types) {
      let has_null = 0
      let has_not_null = 0
      samples.forEach(function (s) {
        if (k === s.t && s.v === null) has_null++
        if (k === s.t && s.v !== null) has_not_null++
      })
      assert(has_null >= 1, 'samples for type ' + k + ' should have a sample testing the NULL value')
      assert(has_not_null >= 1, 'samples for type ' + k + ' should have at least one sample testing a NOT NULL value')
    }
  })
})
