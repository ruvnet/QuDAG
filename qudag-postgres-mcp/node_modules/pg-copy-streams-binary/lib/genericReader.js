/**
 * Documentation is extracted from
 * [1] https://www.postgresql.org/docs/current/static/sql-copy.html for the COPY binary format
 * [2] https://github.com/postgres/postgres/tree/master/src/backend/utils/adt for the send/recv binary formats of types
 */

const { Transform, Readable } = require('stream')
const BP = require('bufferput')
const { decode } = require('./pg_types')
const BufferList = require('bl/BufferList')

const PG_HEADER = 0
const PG_ROW_START = 1
const PG_FIELD_START = 2
const PG_FIELD_DATA = 3
const PG_FIELD_END = 4
const PG_TRAILER = 5

class CopyStream extends Transform {
  constructor(options) {
    super(options)

    // PGCOPY\n\377\r\n\0 (signature + flags field + Header extension area length)
    this.COPYHeaderFull = new BP()
      .put(Buffer.from([0x50, 0x47, 0x43, 0x4f, 0x50, 0x59, 0x0a, 0xff, 0x0d, 0x0a, 0x00]))
      .word32be(0)
      .word32be(0)
      .buffer()

    this._buffer = new BufferList()
    this._state = PG_HEADER
    this._fieldCount = null
    this._fieldIndex = null
    this._fieldLength = null
    this._fieldLengthMissing = null
    this._fieldHolder = null
    this._flowing = true
  }

  _transform(chunk, enc, cb) {
    let done = false
    if (chunk) this._buffer.append(chunk)
    while (this._buffer.length > 0) {
      if (PG_HEADER === this._state) {
        if (this._buffer.length < this.COPYHeaderFull.length) break
        if (!this.COPYHeaderFull.equals(this._buffer.slice(0, this.COPYHeaderFull.length))) {
          return cb(new Error('COPY BINARY Header mismatch'))
        }
        this._buffer.consume(this.COPYHeaderFull.length)
        this._state = PG_ROW_START
      }

      if (PG_ROW_START === this._state) {
        if (this._buffer.length < 2) break
        this._fieldCount = this._buffer.readUInt16BE(0)
        this._buffer.consume(2)
        const UInt16_0xffff = 65535
        if (this._fieldCount === UInt16_0xffff) {
          this._state = PG_TRAILER
        } else {
          this.rowStart()
          this._state = PG_FIELD_START
          this._fieldIndex = -1
        }
      }

      if (PG_TRAILER === this._state) {
        done = true
        break
      }

      if (PG_FIELD_START === this._state) {
        if (this._buffer.length < 4) break
        this._fieldIndex++
        this._fieldLength = this._buffer.readUInt32BE(0)
        this._buffer.consume(4)
        const UInt32_0xffffffff = 4294967295 /* Magic value for NULL */
        if (this._fieldLength === UInt32_0xffffffff) {
          this._fieldHolder = null
          this._fieldLength = 0
          this._state = PG_FIELD_END
        } else {
          this.setupFieldHolder()
          this._state = PG_FIELD_DATA
        }
        this._fieldLengthMissing = this._fieldLength
      }

      if (PG_FIELD_DATA === this._state) {
        if (this._buffer.length === 0) break

        if (this._flowing) {
          const bl = this._buffer.shallowSlice(0, this._fieldLengthMissing)
          this._fieldLengthMissing -= bl.length
          this._buffer.consume(bl.length)
          this.captureFieldData(bl)
        }

        if (this._fieldLengthMissing === 0) {
          this._state = PG_FIELD_END
        } else if (!this._flowing) {
          this.defer_cb = cb
          break
        }
      }

      if (PG_FIELD_END === this._state) {
        this.releaseFieldHolder()
        this._flowing = true
        this._state = PG_FIELD_START
        if (this._fieldIndex === this._fieldCount - 1) {
          this._state = PG_ROW_START
        }
      }
    }

    this.endOfChunk()

    if (done) {
      this.push(null)
      this._fieldHolder = null
      return cb()
    }

    if (!this.defer_cb) cb()
  }

  setupFieldHolder() {
    switch (this.fieldMode()) {
      case 'async':
        const self = this
        this._fieldHolder = new Readable({
          read(size) {
            self._flowing = true
            const cb = self.defer_cb
            self.defer_cb = null
            if (cb) {
              self._transform(null, null, cb)
            }
          },
        })
        this._flowing = false
        this.fieldReady()
        break
      case 'sync':
      default:
        this._fieldHolder = new BufferList()
        break
    }
  }

  captureFieldData(bl) {
    switch (this.fieldMode()) {
      case 'async':
        this._flowing = this._fieldHolder.push(bl.slice())
        break
      case 'sync':
      default:
        this._fieldHolder.append(bl)
        break
    }
  }

  releaseFieldHolder() {
    switch (this.fieldMode()) {
      case 'async':
        this._fieldHolder.push(null)
        this._defer_cb = null
        this._fieldHolder = null
        break
      case 'sync':
      default:
        const type = this.fieldType()
        if (type && this._fieldHolder) {
          this._fieldHolder = decode(this._fieldHolder.slice(), type)
        }
        this.fieldReady()
        this._fieldHolder = null
        break
    }
  }

  fieldMode() {
    // when implemented, should return the sync/async mode of the current field
  }

  fieldReady() {
    // called when a field is ready to be pushed downstream
    // sync: after the field has been fully captured
    // async: as soon as the capturing stream has been prepared
  }

  rowStart() {
    // called when a new row has been detected
  }

  endOfChunk() {
    // called after the maximum parsing that we could do on a chunk
  }

  _flush(cb) {
    cb()
  }
}

module.exports = CopyStream
