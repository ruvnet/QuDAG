const assert = require('assert')
const { rowReader } = require('../')
const { to: copyTo } = require('pg-copy-streams')
const through2 = require('through2')
const concat = require('concat-stream')
const { getClient } = require('./utils')

const samples = {
  bool: [null, true, false],
  bytea: [Buffer.from([0x61]), null, Buffer.from([0x62])],
  int2: [23, -59, null],
  int4: [2938, null, -99283],
  int8: [BigInt(2938), null, BigInt(-99283)],
  text: ['aaa', 'ééé', null],
  json: [JSON.stringify({}), JSON.stringify([1, 2]), null],
  jsonb: [JSON.stringify({}), JSON.stringify({ a: true, b: [4, 2] }), null],
  float4: [0.26350000500679016, null, -3.2929999872755022e-12],
  float8: [9000.12, 9.23e29, null],
  timestamptz: [new Date('2000-01-01T00:00:00Z'), null, new Date('1972-04-25T18:22:00Z')],
}

describe('integration test - rowReader', () => {
  it('test INSERT / COPY TO round trip', (done) => {
    const client = getClient()
    let idx = 1
    const fields = []
    const placeholders = []
    const mapping = []
    const rows = []
    for (const t in samples) {
      fields.push('c' + idx + ' ' + t)
      placeholders.push('$' + idx)
      mapping.push({ key: 'c' + idx, type: t })
      for (let c = 0; c < samples[t].length; c++) {
        rows[c] = rows[c] || []
        rows[c].push(samples[t][c])
      }
      idx++
    }
    client.query('CREATE TEMP TABLE plug (' + fields.join(',') + ')')
    for (let i = 0; i < rows.length; i++) {
      client.query('INSERT INTO plug VALUES (' + placeholders.join(',') + ')', rows[i])
    }

    const sql = 'COPY plug TO STDOUT BINARY'
    const copyOut = client.query(copyTo(sql))
    const p = rowReader({ mapping: mapping })

    idx = 0
    const pipeline = copyOut.pipe(p).pipe(
      through2.obj(
        function (obj, _, cb) {
          for (let i = 0; i < mapping.length; i++) {
            let expected = samples[mapping[i].type][idx]
            let result = obj[mapping[i].key]
            if (expected !== null && result !== null) {
              switch (mapping[i].type) {
                case 'bytea':
                  expected = expected.toString()
                  result = result.toString()
                  break
                case 'json':
                case 'jsonb':
                  result = JSON.stringify(result)
                  break
                case 'timestamptz':
                  expected = expected.getTime()
                  result = result.getTime()
                  break
              }
            }
            try {
              assert.equal(
                expected,
                result,
                'Mismatch for ' + mapping[i].type + ' expected ' + expected + ' got ' + result
              )
            } catch (err) {
              return cb(err)
            }
          }
          idx++
          cb()
        },
        function (cb) {
          client.end()
          try {
            assert.equal(rows.length, idx, `Received a total of ${idx} rows when we were expecting ${rows.length}`)
          } catch (err) {
            return cb(err)
          }
          done()
          cb()
        }
      )
    )
    pipeline.on('error', (err) => {
      client.end()
      done(err)
    })
  })

  it('extract large bytea field', (done) => {
    const power = 16
    const sql = "COPY (select (repeat('-', CAST(2^" + power + ' AS int)))::bytea) TO STDOUT BINARY'
    const client = getClient()
    const copyOutStream = client.query(copyTo(sql))
    const assertResult = (arr) => {
      client.end()
      assert.deepEqual(arr[0].c1, Buffer.alloc(Math.pow(2, power), '-'))
      done()
    }
    const p = rowReader({ mapping: [{ key: 'c1', type: 'bytea' }] })
    p.on('error', (err) => {
      client.end()
      done(err)
    })

    copyOutStream.pipe(p).pipe(concat({ encoding: 'object' }, assertResult))
  })
})
