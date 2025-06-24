'use strict'

const assert = require('assert')
const util = require('util')

const pgtypes = require('../lib/pg_types')
const { decode } = pgtypes

const samples = require('./samples')

function size(ar) {
  const row_count = ar.length
  const row_sizes = []
  for (let i = 0; i < row_count; i++) {
    row_sizes.push(ar[i].length)
  }
  return [row_count, Math.max.apply(null, row_sizes)]
}

function flatten(arr) {
  return arr.reduce((acc, val) => (Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val)), [])
}

describe('decode', () => {
  samples.forEach(function (s) {
    it(`decode type ${s.t}: ${util.inspect(s.v)}`, async () => {
      const buf = s.r
      const isNull = buf.readInt32BE(0)
      const UInt32Len = 4
      let type = s.t
      if (isNull === -1) {
        assert.equal(buf.length, UInt32Len, 'A "null" binary buffer should be 0xffffffff')
      } else {
        let result = decode(buf.slice(UInt32Len), s.t)
        let expected = s.v

        let results = [result]
        let expecteds = [expected]

        if (s.t[0] === '_') {
          assert.equal(size(result).join(','), size(expected).join(','), 'array dimensions should match')
          results = flatten(result)
          expecteds = flatten(expected)
          type = s.t.substr(1)
        }

        assert.equal(results.length, expecteds.length, s.t + ': arrays should have the same global number of members')

        for (let i = 0; i < results.length; i++) {
          result = results[i]
          expected = expecteds[i]
          switch (type) {
            case 'bytea':
              result = result.toString('hex')
              expected = expected.toString('hex')
              break
            case 'json':
            case 'jsonb':
              result = JSON.stringify(result)
              expected = JSON.stringify(expected)
              break
            case 'timestamptz':
              result = result.getTime()
              expected = expected.getTime()
              break
          }
          assert.equal(
            result,
            expected,
            s.t + ': decoded value is incorrect for ' + s.t + ' expected ' + expected + ', got ' + result
          )
        }
      }
    })
  })
})
