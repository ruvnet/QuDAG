const assert = require('assert')
const { rawReader } = require('../')
const { to: copyTo } = require('pg-copy-streams')
const concat = require('concat-stream')
const { getClient } = require('./utils')

describe('integration test - rawReader', () => {
  it('stream all raw bytes / small fields including empty and null', (done) => {
    const sql = `COPY ((SELECT 'a'::bytea, 'b'::bytea, ''::bytea) UNION ALL (SELECT null, 'c'::bytea, 'd'::bytea)) TO STDOUT BINARY`
    const client = getClient()
    const copyOutStream = client.query(copyTo(sql))
    const assertResult = (buf) => {
      client.end()
      assert.deepEqual(buf, Buffer.from('abcd'))
      done()
    }
    const p = rawReader()
    p.on('error', (err) => {
      client.end()
      done(err)
    })
    copyOutStream.pipe(p).pipe(concat({ encoding: 'buffer' }, assertResult))
  })

  it('stream all raw bytes / large fields', (done) => {
    const power = 16
    const bytea = (str) => {
      return `REPEAT('${str}', CAST(2^${power} AS int))::bytea`
    }
    const sql = `COPY ((SELECT ${bytea('-')}, ${bytea('-')}) UNION ALL (SELECT ${bytea('-')}, ${bytea(
      '-'
    )})) TO STDOUT BINARY`
    const client = getClient()
    const copyOutStream = client.query(copyTo(sql))
    const assertResult = (buf) => {
      client.end()
      assert.deepEqual(buf, Buffer.alloc(4 * Math.pow(2, power), '-'))
      done()
    }
    const p = rawReader()
    p.on('error', (err) => {
      client.end()
      done(err)
    })
    copyOutStream.pipe(p).pipe(concat({ encoding: 'buffer' }, assertResult))
  })
})
