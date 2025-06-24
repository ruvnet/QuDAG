const assert = require('assert')
const util = require('util')

const pgtypes = require('../lib/pg_types')
const { encode } = pgtypes

const BP = require('bufferput')
const samples = require('./samples')

describe('encode', () => {
  samples.forEach(function (s) {
    it(`encode type ${s.t}: ${util.inspect(s.v)}`, async () => {
      const buf = encode(new BP(), s.t, s.v).buffer()
      const eq = buf.equals(s.r)
      assert(
        eq,
        'encode ' +
          s.t +
          ' not matching: ' +
          (s.v !== null ? s.v.toString() : 'null') +
          ' => ' +
          buf.toString('hex') +
          ' / ' +
          s.r.toString('hex')
      )
    })
  })
})
