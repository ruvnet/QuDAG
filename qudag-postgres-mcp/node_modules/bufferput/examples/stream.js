#!/usr/bin/env node

var BufferPut = require('bufferput');
(new BufferPut())
    .word16be(24930)
    .word32le(1717920867)
    .word8(103)
    .write(process.stdout)
;
