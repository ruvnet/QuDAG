BufferPut
===

Pack multibyte binary values into buffers with specific endiannesses.  Based
on the original Put by https://github.com/substack/node-put ...this version
is intended to be a little more conventional in structure and faster
to instantiate and easier for a VM to optimize.  Instantiation of this version
is more that 500x faster than the original as measured on nodejs 0.10.12.

Installation
============

To install with [npm](http://github.com/isaacs/npm):
 
    npm install bufferput

To run the tests with [expresso](http://github.com/visionmedia/expresso):

    expresso

Examples
========

buf.js
------

Build a buffer

    #!/usr/bin/env node

    var BufferPut = require('bufferput');
    var buf = (new BufferPut())
        .word16be(1337)
        .word8(1)
        .pad(5)
        .put(new Buffer('pow', 'ascii'))
        .word32le(9000)
        .buffer()
    ;
    console.log(buf);

Output:
    <Buffer 05 39 01 00 00 00 00 00 70 6f 77 28 23 00 00>

stream.js
---------

Send a buffer to a writeable stream

    #!/usr/bin/env node

    var BufferPut = require('bufferput');
    (new BufferPut())
        .word16be(24930)
        .word32le(1717920867)
        .word8(103)
        .write(process.stdout)
    ;

Output:
    abcdefg
