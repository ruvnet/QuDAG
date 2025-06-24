var stream = require("stream")

var MultiFork = module.exports = function MultiFork(n, options) {
  options = options || {}

  options.objectMode = true

  stream.Writable.call(this, options)

  if (options.classifier) {
    this._classifier = options.classifier
  }

  for (var i = 0; i < n; i++) {
    this.streams.push(new stream.Readable(options))
  }

  var self = this

  var resume = function resume() {
    if (self.resume) {
      var r = self.resume
      self.resume = null
      r.call(null)
    }
  }

  for (var i in this.streams) {
    this.streams[i]._read = resume
  }

  this.on("finish", function() {
    for (var i = 0; i < n; i++) {
      self.streams[i].push(null)
    }
  })
}

MultiFork.prototype = Object.create(stream.Writable.prototype, {constructor: {value: MultiFork}})

MultiFork.prototype.streams = []

MultiFork.prototype._classifier = function(e, done) {
  return done(null, !!e)
}

MultiFork.prototype._write = function _write(input, encoding, done) {

  var self = this

  this._classifier.call(null, input, function(err, index) {
    if (err) {
      return done(err)
    }

    //console.log(self.streams[index], index)

    //var out = self.streams[index]

    if (self.streams[index].push(input)) {
      return done()
    } else {
      self.resume = done
    }
  })
}
