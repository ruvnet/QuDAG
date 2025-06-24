const assert = require('assert')
const async = require('async')

const { to: pgCopyTo, from: pgCopyFrom } = require('pg-copy-streams')
const through2 = require('through2')

const { getClient } = require('./utils')
const { transform } = require('../')

describe('integration test - transform', () => {
  it('should correclty extract, transform and load data', (done) => {
    const clientA = getClient()
    const clientB = getClient()
    const clientC = getClient()

    const queriesA = [
      'DROP TABLE IF EXISTS item',
      'CREATE TABLE item (id serial PRIMARY KEY, ref text, description text)',
      "INSERT INTO item (ref, description) VALUES ('1:CTX', 'A little item')",
      "INSERT INTO item (ref, description) VALUES ('2:CTX', 'A BIG item')",
    ]

    const queriesB = [
      'DROP TABLE IF EXISTS product',
      'CREATE TABLE product (code int4 PRIMARY KEY, label text, description text, ts_creation timestamptz, matrix int2[][])',
    ]

    const queriesC = ['DROP TABLE IF EXISTS generated', 'CREATE TABLE generated (body text)']

    // we simplify by observing here that A=B when tests are executed
    async.eachSeries(queriesA.concat(queriesB, queriesC), clientA.query.bind(clientA), function (err) {
      if (err) return done(err)

      const copyOut = clientA.query(pgCopyTo('COPY item TO STDOUT BINARY'))
      const copyIns = [
        clientB.query(pgCopyFrom('COPY product   FROM STDIN BINARY')),
        clientC.query(pgCopyFrom('COPY generated FROM STDIN BINARY')),
      ]

      let count = 0
      const pct = transform({
        mapping: [
          { key: 'id', type: 'int4' },
          { key: 'ref', type: 'text' },
          { key: 'description', type: 'text' },
        ],
        targets: copyIns,
        transform: through2.obj(
          function (row, _, cb) {
            let id = parseInt(row.ref.split(':')[0])
            const d = new Date('1999-01-01T00:00:00Z')
            d.setDate(d.getDate() + id)
            count++
            this.push([
              0,
              { type: 'int4', value: id },
              { type: 'text', value: row.ref.split(':')[1] },
              { type: 'text', value: row.description.toLowerCase() },
              { type: 'timestamptz', value: d },
              {
                type: '_int2',
                value: [
                  [id, id + 1],
                  [id + 2, id + 3],
                ],
              },
            ])
            while (id > 0) {
              count++
              this.push([1, { type: 'text', value: 'BODY: ' + row.description }])
              id--
            }
            cb()
          },
          function (cb) {
            this.push([1, { type: 'text', value: 'COUNT: ' + count }])
            cb()
          }
        ),
      })

      copyOut.pipe(pct)
      pct.on('close', function (err) {
        if (err) return done(err)
        let running = 3
        clientA.query('SELECT * FROM item', function (err, res) {
          clientA.end()
          if (err) return done(err)
          try {
            assert.equal(res.rowCount, 2, 'expected 2 tuples on A, but got ' + res.rowCount)
          } catch (err) {
            return done(err)
          }
          running--
          if (!running) done()
        })
        clientB.query('SELECT * FROM product ORDER BY code ASC', function (err, res) {
          clientB.end()
          if (err) return done(err)
          try {
            const d = new Date('1999-01-01T00:00:00Z')
            assert.equal(res.rowCount, 2, 'expected 2 tuples on B, but got ' + res.rowCount)

            // first row
            assert.equal(res.rows[0].code, 1)
            assert.equal(res.rows[0].label, 'CTX')
            assert.equal(res.rows[0].description, 'a little item')
            assert.equal(res.rows[0].ts_creation.getTime(), d.getTime() + 1 * 24 * 60 * 60 * 1000)
            assert.equal(JSON.stringify(res.rows[0].matrix), '[[1,2],[3,4]]')

            // second row
            assert.equal(res.rows[1].code, 2)
            assert.equal(res.rows[1].label, 'CTX')
            assert.equal(res.rows[1].description, 'a big item')
            assert.equal(JSON.stringify(res.rows[1].matrix), '[[2,3],[4,5]]')
          } catch (err) {
            return done(err)
          }
          running--
          if (!running) done()
        })

        clientC.query('SELECT * FROM generated ORDER BY body ASC', function (err, res) {
          clientC.end()
          if (err) return done(err)
          try {
            assert.equal(res.rows[0].body, 'BODY: A BIG item')
            assert.equal(res.rows[1].body, 'BODY: A BIG item')
            assert.equal(res.rows[2].body, 'BODY: A little item')
            assert.equal(res.rows[3].body, 'COUNT: 5')
          } catch (err) {
            return done(err)
          }
          running--
          if (!running) done()
        })
      })
    })
  })
})
