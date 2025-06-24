const assert = require('assert')
const util = require('util')
const { rowWriter } = require('../')
const { from: copyFrom } = require('pg-copy-streams')
const { getClient } = require('./utils')

describe('integration test - copyIn', () => {
  it('ingesting an empty flow should not trigger an error', (done) => {
    const client = getClient()
    client.query('CREATE TEMP TABLE plug (col1 text)')
    const sql = 'COPY plug FROM STDIN BINARY'
    const copyIn = client.query(copyFrom(sql))
    const encoder = rowWriter()
    encoder.pipe(copyIn)
    const cleanup = (err) => {
      done(err)
      client.end()
    }
    copyIn.on('finish', cleanup)
    copyIn.on('error', cleanup)
    copyIn.on('error', cleanup)
    encoder.end()
  })

  const samples = [
    ['bool', 0, null, null],
    ['bool', 0, true, 'true'],
    ['bool', 0, false, 'false'],
    ['bool', 1, [true, false], '{t,f}'],
    ['int2', 0, 0, '0'],
    ['int2', 0, 7, '7'],
    ['int2', 1, [2, 9], '{2,9}'],
    [
      'int2',
      2,
      [
        [1, 2],
        [3, 4],
      ],
      '{{1,2},{3,4}}',
    ],
    ['int4', 0, null, null],
    ['int4', 0, 7, '7'],
    ['int4', 1, [2, 9], '{2,9}'],
    [
      'int4',
      2,
      [
        [1, 2],
        [3, 4],
      ],
      '{{1,2},{3,4}}',
    ],
    ['int8', 0, null, null],
    ['int8', 0, BigInt('501007199254740991'), '501007199254740991'],
    [
      'int8',
      1,
      [BigInt('501007199254740991'), BigInt('501007199254740999')],
      '{501007199254740991,501007199254740999}',
    ],
    [
      'int8',
      2,
      [
        [BigInt('501007199254740991'), BigInt('501007199254740999')],
        [BigInt('501007199254740993'), BigInt('501007199254740994')],
      ],
      '{{501007199254740991,501007199254740999},{501007199254740993,501007199254740994}}',
    ],
    ['float4', 0, 0.2736, '0.2736'],
    ['float4', 0, 2.928e27, '2.928e+27'],
    ['float8', 0, 7.23e50, '7.23e+50'],
    ['json', 0, { a: 1, b: 2 }, '{"a":1,"b":2}'],
    ['json', 1, [{ a: 1 }, {}], '{"{\\"a\\":1}","{}"}'],
    ['jsonb', 0, { a: 1, b: 2 }, '{"a": 1, "b": 2}'],
    ['jsonb', 1, [{ a: 1 }, {}], '{"{\\"a\\": 1}","{}"}'],
    ['timestamptz', 0, new Date('2017-04-25T18:22:00Z'), '2017-04-25 18:22:00+00'],
  ]

  samples.forEach(function (s) {
    const [type, ndim, value, expectedText] = s
    it(`test type ${type}: ${util.inspect(value)}`, (done) => {
      const client = getClient()
      const atype = (ndim > 0 ? '_' : '') + type
      const coltype = type + '[]'.repeat(ndim)
      client.query('CREATE TEMP TABLE plug (col1 ' + coltype + ')')
      const sql = 'COPY plug FROM STDIN BINARY'
      const copyIn = client.query(copyFrom(sql))
      const encoder = rowWriter()
      encoder.pipe(copyIn)
      copyIn.on('finish', () => {
        const sql = 'SELECT col1::text FROM plug'
        client.query(sql, function (err, res) {
          client.end()
          if (err) return done(err)
          try {
            assert.equal(
              res.rows[0].col1,
              expectedText,
              'expected ' +
                expectedText +
                ' for ' +
                coltype +
                ' row but got ' +
                (res.rows.length ? res.rows[0].col1 : '0 rows')
            )
          } catch (err) {
            return done(err)
          }
          done()
        })
      })
      encoder.end([{ type: atype, value: value }])
    })
  })
})
