/**
 * Documentation is extracted from
 * [1] https://www.postgresql.org/docs/current/static/sql-copy.html for the COPY binary format
 * [2] https://github.com/postgres/postgres/tree/master/src/backend/utils/adt for the send/recv binary formats of types
 */

module.exports = function (txt, options) {
  return new CopyStream(txt, options)
}

const { Transform } = require('stream')

const BufferPut = require('bufferput')
const { encode } = require('./pg_types')

class CopyStream extends Transform {
  constructor(options = {}) {
    options.writableObjectMode = true
    super(options)

    this._headerSent = options.COPY_sendHeader === false
    this._trailerSent = options.COPY_sendTrailer === false

    // PGCOPY\n\377\r\n\0
    this.COPYSignature = Buffer.from([0x50, 0x47, 0x43, 0x4f, 0x50, 0x59, 0x0a, 0xff, 0x0d, 0x0a, 0x00])
  }

  sendHeader(buf) {
    buf.put(this.COPYSignature)
    buf.word32be(0) // flags field (OID are not included in data)
    buf.word32be(0) // Header extention area is empty
  }

  _transform(chunk, enc, cb) {
    const buf = new BufferPut()
    const fieldCount = chunk.length

    // See [1] - File Header Section
    if (!this._headerSent) {
      this._headerSent = true
      this.sendHeader(buf)
    }

    // See [1] - Tuples Section
    // Each tuple begins with a 16-bit integer count of the number of fields in the tuple.
    // (Presently, all tuples in a table will have the same count, but that might not always be true.)
    buf.word16be(fieldCount)

    // See [1] - Tuples Section
    // Then, repeated for each field in the tuple, there is a 32-bit length word followed by that many bytes of field data.
    // (The length word does not include itself, and can be zero.)
    let i
    let vec
    for (i = 0; i < fieldCount; i++) {
      vec = chunk[i]
      encode(buf, vec.type, vec.value)
    }

    this.push(buf.buffer())

    cb()
  }

  _flush(cb) {
    const buf = new BufferPut()

    // See [1] - File Header Section
    if (!this._headerSent) {
      this._headerSent = true
      this.sendHeader(buf)
    }

    // See [1] - File Trailer section
    if (!this._trailerSent) {
      this._trailerSent = true
      buf.put(Buffer.from([0xff, 0xff]))
    }

    this.push(buf.buffer())
    cb()
  }
}
