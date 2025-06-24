module.exports = function (txt, options) {
  return new rowReader(txt, options)
}

const binaryReader = require('./genericReader')

class rowReader extends binaryReader {
  constructor(options = {}) {
    options.readableObjectMode = true
    super(options)
    this.mapping = options.mapping || false
  }

  fieldReady() {
    const o = {}
    o._fieldIndex = this._fieldIndex
    o._fieldCount = this._fieldCount
    o._fieldLength = this._fieldLength
    const key = this.mapping ? this.mapping[this._fieldIndex].key : 'value'
    o.name = key
    o.value = this._fieldHolder
    this.push(o)
  }

  fieldMode() {
    return this.mapping ? this.mapping[this._fieldIndex].mode : 'sync'
  }

  fieldType() {
    return this.mapping ? this.mapping[this._fieldIndex].type : null
  }
}
