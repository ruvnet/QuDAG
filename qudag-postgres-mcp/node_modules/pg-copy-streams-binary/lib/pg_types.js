const ieee754 = require('ieee754')
const int64 = require('int64-buffer')

// bool
const boolsend = function (buf, value) {
  buf.word8be(value ? 1 : 0)
}
const boolrecv = function (buf) {
  return buf.readUInt8(0) ? true : false
}

// bytea
const byteasend = function (buf, value) {
  buf.put(value)
}
const bytearecv = function (buf) {
  return buf
}

// int2
const int2send = function (buf, value) {
  buf.word16be(value)
}
const int2recv = function (buf) {
  return buf.readInt16BE(0)
}

// int4
const int4send = function (buf, value) {
  buf.word32be(value)
}
const int4recv = function (buf) {
  return buf.readInt32BE(0)
}

// int8
const int8send = function (buf, value) {
  const tbuf = Buffer.allocUnsafe(8)
  tbuf.writeBigInt64BE(value)
  buf.put(tbuf)
}
const int8recv = function (buf) {
  return buf.readBigInt64BE(0)
}

// text
const textsend = function (buf, value) {
  const tbuf = Buffer.from(value, 'utf-8')
  buf.put(tbuf)
}
const textrecv = function (buf) {
  return buf.toString('utf-8')
}

// varchar
const varcharsend = textsend
const varcharrecv = textrecv

// json
const json_send = function (buf, value) {
  const jbuf = Buffer.from(JSON.stringify(value), 'utf-8')
  buf.put(jbuf)
}
const json_recv = function (buf) {
  return JSON.parse(buf.toString('utf-8'))
}

// jsonb
const jsonb_send = function (buf, value) {
  const jbuf = Buffer.from('\u0001' + JSON.stringify(value), 'utf-8')
  buf.put(jbuf)
}
const jsonb_recv = function (buf) {
  return JSON.parse(buf.slice(1).toString('utf-8'))
}

// float4
const float4send = function (buf, value) {
  const fbuf = Buffer.alloc(4)
  ieee754.write(fbuf, value, 0, false, 23, 4)
  buf.put(fbuf)
}
const float4recv = function (buf) {
  return ieee754.read(buf, 0, false, 23, 4)
}

// float8
const float8send = function (buf, value) {
  const fbuf = Buffer.alloc(8)
  ieee754.write(fbuf, value, 0, false, 52, 8)
  buf.put(fbuf)
}
const float8recv = function (buf) {
  return ieee754.read(buf, 0, false, 52, 8)
}

// timestamptz
// NB: This is only for the HAVE_INT64_TIMESTAMP case
// in PostgreSQL source code so there may be some work needed
// to interact with other architures
const timestamptz_send = function (buf, value) {
  // postgres origin of time is 01/01/2000
  let ts = value.getTime() - 946684800000
  ts = 1000 * ts // add unknown usecs
  const tbuf = Buffer.alloc(8)
  int64.Int64BE(tbuf, 0, ts)
  buf.put(tbuf)
}
const timestamptz_recv = function (buf) {
  let ts = int64.Int64BE(buf)
  ts = ts / 1000
  ts = ts + 946684800000
  return new Date(ts)
}

// array
const array_send = function (atype, buf, value) {
  let tmp
  let ndim = 0

  // count # of dimensions
  tmp = value
  while (Array.isArray(tmp)) {
    ndim++
    tmp = tmp[0]
  }
  buf.word32be(ndim) // ndim
  buf.word32be(0) // hasnull
  buf.word32be(types[atype].oid) // elem oid

  // for each dimension, declare
  // - size of dimension
  // - index of first item in dimension (1)
  tmp = value
  for (let i = 0; i < ndim; i++) {
    buf.word32be(tmp.length)
    buf.word32be(1)
    tmp = tmp[0]
  }

  // elems are flattened on 1-dim
  const flat = flatten(value)
  const len = flat.length
  for (let i = 0; i < len; i++) {
    encode(buf, atype, flat[i])
  }
}
// note the type is not necessary here because it is embedded inside the
// array
const array_recv = function (buf) {
  let offset = 0
  const UInt32Len = 4
  const ndim = buf.readUInt32BE(offset)
  offset += UInt32Len
  // eslint-disable-next-line no-unused-vars
  const hasnull = buf.readUInt32BE(offset)
  offset += UInt32Len
  const typoid = buf.readUInt32BE(offset)
  offset += UInt32Len
  let type
  // eslint-disable-next-line no-unused-vars
  let found = false
  for (type in types) {
    if (types[type].oid === typoid) {
      // eslint-disable-next-line no-unused-vars
      found = true
      break
    }
  }
  // description of dimensions
  const dims = []
  const lowers = []
  let len = 1
  for (let i = 0; i < ndim; i++) {
    const n = buf.readUInt32BE(offset)
    len = len * n
    dims.push(n)
    offset += UInt32Len
    lowers.push(buf.readUInt32BE(offset))
    offset += UInt32Len
  }
  // fetch flattenned data
  let flat = []
  for (let i = 0; i < len; i++) {
    const fieldLen = buf.readUInt32BE(offset)
    offset += UInt32Len
    flat.push(decode(buf.slice(offset, offset + fieldLen), type))
    offset += fieldLen
  }
  let size
  dims.shift()
  while ((size = dims.pop())) {
    flat = chunk(flat, size)
  }
  return flat
}

function chunk(array, size) {
  const result = []
  for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size))
  return result
}

// Note that send function names are kept identical to their names in the PostgreSQL source code.
const types = {
  bool: { oid: 16, send: boolsend, recv: boolrecv },
  bytea: { oid: 17, send: byteasend, recv: bytearecv },
  int2: { oid: 21, send: int2send, recv: int2recv },
  int4: { oid: 23, send: int4send, recv: int4recv },
  int8: { oid: 20, send: int8send, recv: int8recv },
  text: { oid: 25, send: textsend, recv: textrecv },
  varchar: { oid: 1043, send: varcharsend, recv: varcharrecv },
  json: { oid: 114, send: json_send, recv: json_recv },
  jsonb: { oid: 3802, send: jsonb_send, recv: jsonb_recv },
  float4: { oid: 700, send: float4send, recv: float4recv },
  float8: { oid: 701, send: float8send, recv: float8recv },
  timestamptz: { oid: 1184, send: timestamptz_send, recv: timestamptz_recv },
  _bool: { oid: 1000, send: array_send.bind(null, 'bool'), recv: array_recv },
  _bytea: { oid: 1001, send: array_send.bind(null, 'bytea'), recv: array_recv },
  _int2: { oid: 1005, send: array_send.bind(null, 'int2'), recv: array_recv },
  _int4: { oid: 1007, send: array_send.bind(null, 'int4'), recv: array_recv },
  _int8: { oid: 1016, send: array_send.bind(null, 'int8'), recv: array_recv },
  _text: { oid: 1009, send: array_send.bind(null, 'text'), recv: array_recv },
  _varchar: { oid: 1015, send: array_send.bind(null, 'varchar'), recv: array_recv },
  _json: { oid: 199, send: array_send.bind(null, 'json'), recv: array_recv },
  _jsonb: { oid: 3807, send: array_send.bind(null, 'jsonb'), recv: array_recv },
  _float4: { oid: 1021, send: array_send.bind(null, 'float4'), recv: array_recv },
  _float8: { oid: 1022, send: array_send.bind(null, 'float8'), recv: array_recv },
  _timestamptz: { oid: 1185, send: array_send.bind(null, 'timestamptz'), recv: array_recv },
}

function encode(buf, type, value) {
  // Add a UInt32  placeholder for the field length
  buf.word32be(0)
  const lenField = buf.words[buf.words.length - 1]

  // See [1] - Tuples Section
  // As a special case, -1 indicates a NULL field value. No value bytes follow in the NULL case
  if (value === null) {
    lenField.value = -1

    // Then, repeated for each field in the tuple, there is a 32-bit length word followed by
    // that many bytes of field data.
  } else if (types[type]) {
    const offset = buf.len
    types[type].send(buf, value)
    lenField.value = buf.len - offset
  }
  return buf
}

function decode(buf, type) {
  return types[type].recv(buf)
}

function flatten(arr) {
  return arr.reduce((acc, val) => (Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val)), [])
}

module.exports = {
  types: types,
  encode: encode,
  decode: decode,
}
