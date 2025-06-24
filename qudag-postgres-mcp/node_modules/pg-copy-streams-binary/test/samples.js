const pgtypes = require('../lib/pg_types')
const { types } = pgtypes
const BP = require('bufferput')

BP.prototype.string = function (s, enc) {
  const buf = Buffer.from(s, enc)
  return this.put(buf)
}

function makeBigIntBuffer(value) {
  const buf = Buffer.alloc(8)
  buf.writeBigInt64BE(BigInt(value))
  return buf
}

module.exports = [
  // simple types
  { t: 'bool', v: null, r: new BP().word32be(-1).buffer() },
  { t: 'bool', v: true, r: new BP().word32be(1).word8(1).buffer() },
  { t: 'bool', v: false, r: new BP().word32be(1).word8(0).buffer() },
  { t: 'bytea', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: 'bytea',
    v: Buffer.from([0x33, 0x22, 0x11, 0x00]),
    r: new BP()
      .word32be(4)
      .put(Buffer.from([0x33, 0x22, 0x11, 0x00]))
      .buffer(),
  },
  { t: 'int2', v: null, r: new BP().word32be(-1).buffer() },
  { t: 'int2', v: 128, r: new BP().word32be(2).word16be(128).buffer() },
  { t: 'int4', v: null, r: new BP().word32be(-1).buffer() },
  { t: 'int4', v: 128, r: new BP().word32be(4).word32be(128).buffer() },
  { t: 'int8', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: 'int8',
    v: BigInt('128'),
    r: new BP().word32be(8).put(makeBigIntBuffer('128')).buffer(),
  },
  { t: 'text', v: null, r: new BP().word32be(-1).buffer() },
  { t: 'text', v: 'hello', r: new BP().word32be(5).put(Buffer.from('hello')).buffer() },
  { t: 'text', v: 'utf8 éà', r: new BP().word32be(9).put(Buffer.from('utf8 éà', 'utf-8')).buffer() },
  { t: 'varchar', v: null, r: new BP().word32be(-1).buffer() },
  { t: 'varchar', v: 'hello', r: new BP().word32be(5).put(Buffer.from('hello')).buffer() },
  { t: 'varchar', v: 'utf8 éà', r: new BP().word32be(9).put(Buffer.from('utf8 éà', 'utf-8')).buffer() },
  { t: 'json', v: null, r: new BP().word32be(-1).buffer() },
  { t: 'json', v: { a: true, b: [1, 7] }, r: new BP().word32be(20).string('{"a":true,"b":[1,7]}', 'utf-8').buffer() },
  { t: 'jsonb', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: 'jsonb',
    v: { a: true, b: [1, 7] },
    r: new BP().word32be(21).string('\u0001{"a":true,"b":[1,7]}', 'utf-8').buffer(),
  },
  // online float4+float8 hex converter, http://gregstoll.dyndns.org/~gregstoll/floattohex/
  { t: 'float4', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: 'float4',
    v: 0.12300000339746475,
    r: new BP()
      .word32be(4)
      .put(Buffer.from([0x3d, 0xfb, 0xe7, 0x6d]))
      .buffer(),
  },
  { t: 'float8', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: 'float8',
    v: 42.4242,
    r: new BP()
      .word32be(8)
      .put(Buffer.from([0x40, 0x45, 0x36, 0x4c, 0x2f, 0x83, 0x7b, 0x4a]))
      .buffer(),
  },
  { t: 'timestamptz', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: 'timestamptz',
    v: new Date('2000-01-01T00:00:00Z'),
    r: new BP()
      .word32be(8)
      .put(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
      .buffer(),
  }, // 0
  {
    t: 'timestamptz',
    v: new Date('2000-01-01T00:00:01Z'),
    r: new BP()
      .word32be(8)
      .put(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x0f, 0x42, 0x40]))
      .buffer(),
  }, // 1.000.000
  {
    t: 'timestamptz',
    v: new Date('1999-12-31T00:00:00Z'),
    r: new BP()
      .word32be(8)
      .put(Buffer.from([0xff, 0xff, 0xff, 0xeb, 0xe2, 0x28, 0xa0, 0x00]))
      .buffer(),
  }, // -86400x10e6
  // arrays
  { t: '_bool', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: '_bool',
    v: [true, false],
    r: new BP()
      .word32be(30)
      .word32be(1)
      .word32be(0)
      .word32be(types['bool'].oid)
      .word32be(2)
      .word32be(1)
      .word32be(1)
      .word8(1)
      .word32be(1)
      .word8(0)
      .buffer(),
  },
  { t: '_int2', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: '_int2',
    v: [5, 7],
    r: new BP()
      .word32be(32)
      .word32be(1)
      .word32be(0)
      .word32be(types['int2'].oid)
      .word32be(2)
      .word32be(1)
      .word32be(2)
      .word16be(5)
      .word32be(2)
      .word16be(7)
      .buffer(),
  },
  { t: '_int4', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: '_int4',
    v: [
      [1, 2],
      [3, 4],
      [5, 6],
    ],
    r: new BP()
      .word32be(76)
      .word32be(2)
      .word32be(0)
      .word32be(types['int4'].oid)
      .word32be(3)
      .word32be(1)
      .word32be(2)
      .word32be(1)
      .word32be(4)
      .word32be(1)
      .word32be(4)
      .word32be(2)
      .word32be(4)
      .word32be(3)
      .word32be(4)
      .word32be(4)
      .word32be(4)
      .word32be(5)
      .word32be(4)
      .word32be(6)
      .buffer(),
  },
  { t: '_int8', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: '_int8',
    v: [
      [BigInt('1'), BigInt('2')],
      [BigInt('3'), BigInt('4')],
    ],
    r: new BP()
      .word32be(76)
      .word32be(2)
      .word32be(0)
      .word32be(types['int8'].oid)
      .word32be(2)
      .word32be(1)
      .word32be(2)
      .word32be(1)
      .word32be(8)
      .put(makeBigIntBuffer('1'))
      .word32be(8)
      .put(makeBigIntBuffer('2'))
      .word32be(8)
      .put(makeBigIntBuffer('3'))
      .word32be(8)
      .put(makeBigIntBuffer('4'))
      .buffer(),
  },
  { t: '_bytea', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: '_bytea',
    v: [Buffer.from([61, 62]), Buffer.from([62, 61])],
    r: new BP()
      .word32be(32)
      .word32be(1)
      .word32be(0)
      .word32be(types['bytea'].oid)
      .word32be(2)
      .word32be(1)
      .word32be(2)
      .word8(61)
      .word8(62)
      .word32be(2)
      .word8(62)
      .word8(61)
      .buffer(),
  },
  { t: '_text', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: '_text',
    v: ['ab', 'cd'],
    r: new BP()
      .word32be(32)
      .word32be(1)
      .word32be(0)
      .word32be(types['text'].oid)
      .word32be(2)
      .word32be(1)
      .word32be(2)
      .word8(97)
      .word8(98)
      .word32be(2)
      .word8(99)
      .word8(100)
      .buffer(),
  },
  { t: '_varchar', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: '_varchar',
    v: ['ab', 'cd'],
    r: new BP()
      .word32be(32)
      .word32be(1)
      .word32be(0)
      .word32be(types['varchar'].oid)
      .word32be(2)
      .word32be(1)
      .word32be(2)
      .word8(97)
      .word8(98)
      .word32be(2)
      .word8(99)
      .word8(100)
      .buffer(),
  },
  { t: '_json', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: '_json',
    v: [{ a: 1 }, { c: 3 }],
    r: new BP()
      .word32be(42)
      .word32be(1)
      .word32be(0)
      .word32be(types['json'].oid)
      .word32be(2)
      .word32be(1)
      .word32be(7)
      .string('{"a":1}', 'utf-8')
      .word32be(7)
      .string('{"c":3}', 'utf-8')
      .buffer(),
  },
  { t: '_jsonb', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: '_jsonb',
    v: [{ a: 1 }, { c: 3 }],
    r: new BP()
      .word32be(44)
      .word32be(1)
      .word32be(0)
      .word32be(types['jsonb'].oid)
      .word32be(2)
      .word32be(1)
      .word32be(8)
      .string('\u0001{"a":1}', 'utf-8')
      .word32be(8)
      .string('\u0001{"c":3}', 'utf-8')
      .buffer(),
  },
  { t: '_float4', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: '_float4',
    v: [0.12300000339746475, 0.12300000339746475],
    r: new BP()
      .word32be(36)
      .word32be(1)
      .word32be(0)
      .word32be(types['float4'].oid)
      .word32be(2)
      .word32be(1)
      .word32be(4)
      .put(Buffer.from([0x3d, 0xfb, 0xe7, 0x6d]))
      .word32be(4)
      .put(Buffer.from([0x3d, 0xfb, 0xe7, 0x6d]))
      .buffer(),
  },
  { t: '_float8', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: '_float8',
    v: [42.4242, 42.4242],
    r: new BP()
      .word32be(44)
      .word32be(1)
      .word32be(0)
      .word32be(types['float8'].oid)
      .word32be(2)
      .word32be(1)
      .word32be(8)
      .put(Buffer.from([0x40, 0x45, 0x36, 0x4c, 0x2f, 0x83, 0x7b, 0x4a]))
      .word32be(8)
      .put(Buffer.from([0x40, 0x45, 0x36, 0x4c, 0x2f, 0x83, 0x7b, 0x4a]))
      .buffer(),
  },
  { t: '_timestamptz', v: null, r: new BP().word32be(-1).buffer() },
  {
    t: '_timestamptz',
    v: [new Date('2000-01-01T00:00:00Z'), new Date('2000-01-01T00:00:01Z')],
    r: new BP()
      .word32be(44)
      .word32be(1)
      .word32be(0)
      .word32be(types['timestamptz'].oid)
      .word32be(2)
      .word32be(1)
      .word32be(8)
      .put(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
      .word32be(8)
      .put(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x0f, 0x42, 0x40]))
      .buffer(),
  },
]
