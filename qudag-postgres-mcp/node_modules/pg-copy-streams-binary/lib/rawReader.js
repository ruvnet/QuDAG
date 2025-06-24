module.exports = function (txt, options) {
  return new rowReader(txt, options)
}

const BufferList = require('bl/BufferList')
const binaryReader = require('./genericReader')

class rowReader extends binaryReader {
  constructor(options = {}) {
    super(options)
    this._rawHolder = new BufferList()
  }

  endOfChunk() {
    const len = this._rawHolder.length
    if (len) {
      const buf = this._rawHolder.slice()
      this._rawHolder.consume(len)
      this.push(buf)
    }
  }

  setupFieldHolder() {}

  captureFieldData(bl) {
    this._rawHolder.append(bl)
  }

  releaseFieldHolder() {}

  _flush(cb) {
    this._rawHolder = null
    super._flush(cb)
  }
}
