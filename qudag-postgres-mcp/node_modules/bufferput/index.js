function BufferPut () {
  this.words = [];
  this.len = 0;
};
module.exports = BufferPut;

BufferPut.prototype.put = function(buf) {
  this.words.push({buffer: buf});
  this.len += buf.length;
  return this;
};

BufferPut.prototype.insert = function(bufferput) {
  this.words = this.words.concat(bufferput.words);
  this.len += bufferput.len;
}

BufferPut.prototype.word8 = function(x) {
  this.words.push({bytes: 1, value: x});
  this.len += 1;
  return this;
};

BufferPut.prototype.floatle = function(x) {
  this.words.push({bytes: 'float', endian: 'little', value: x});
  this.len += 4;
  return this;
};

BufferPut.prototype.varint = function(i) {
  if(i < 0xFD) {
    this.word8(i);
  } else if(i <= 1<<16) {
    this.word8(0xFD);
    this.word16le(i);
  } else if(i <= 1<<32) {
    this.word8(0xFE);
    this.word32le(i);
  } else {
    this.word8(0xFF);
    this.word64le(i);
  }
};

[8, 16, 24, 32, 64].forEach(function(bits) {
  BufferPut.prototype['word'+bits+'be'] = function(x) {
    this.words.push({endian: 'big', bytes: bits / 8, value: x});
    this.len += bits / 8;
    return this;
  };

  BufferPut.prototype['word'+bits+'le'] = function(x) {
    this.words.push({endian: 'little', bytes: bits / 8, value: x});
    this.len += bits / 8;
    return this;
  };
});

BufferPut.prototype.pad = function(bytes) {
  this.words.push({endian: 'big', bytes: bytes, value: 0});
  this.len += bytes;
  return this;
};

BufferPut.prototype.length = function() {
  return this.len;
};

BufferPut.prototype.buffer = function () {
  var buf = new Buffer(this.len);
  var offset = 0;
  this.words.forEach(function(word) {
    if(word.buffer) {
      word.buffer.copy(buf, offset, 0);
      offset += word.buffer.length;
    } else if(word.bytes == 'float') {
      // s * f * 2^e
      var v = Math.abs(word.value);
      var s = (word.value >= 0) * 1;
      var e = Math.ceil(Math.log(v) / Math.LN2);
      var f = v / (1 << e);

      // s:1, e:7, f:23
      // [seeeeeee][efffffff][ffffffff][ffffffff]
      buf[offset++] = (s << 7) & ~~(e / 2);
      buf[offset++] = ((e & 1) << 7) & ~~(f / (1 << 16));
      buf[offset++] = 0;
      buf[offset++] = 0;
      offset += 4;
    } else {
      var big = word.endian === 'big';
      var ix = big ? [ (word.bytes - 1) * 8, -8 ] : [ 0, 8 ];
      for(var i=ix[0]; big ? i >= 0 : i < word.bytes * 8; i += ix[1]) {
        if(i >= 32) {
          buf[offset++] = Math.floor(word.value / Math.pow(2, i)) & 0xff;
        } else {
          buf[offset++] = (word.value >> i) & 0xff;
        }
      }
    }
  });
  return buf;
};

BufferPut.prototype.write = function(stream) {
  stream.write(this.buffer());
};
