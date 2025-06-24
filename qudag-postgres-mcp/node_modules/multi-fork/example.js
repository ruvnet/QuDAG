#!/usr/bin/env node

var MultiFork = require("./")
var _ = require('highland')
var u = require('underscore')

var streamJohn = _().each(function(data) {
      console.log(_.extend(data, {sendTo: 'John'}))
    })
var streamAnna = _().each(function(data) {
      console.log(_.extend(data, {sendTo: 'Anna'}))
    })
var streamBill = _().each(function(data) {
      console.log(_.extend(data, {sendTo: 'Bill'}))
    })

var outputStreams = [streamJohn, streamAnna, streamBill]

var docs = [
  {type: 'Apple'},
  {type: 'Banana'},
  {type: 'Coco'},
  {type: 'Coco'}
]
var partitionByKey = 'type'
var partitionRanges = ['Apple', 'Banana', 'Coco']

var classifier = function(doc, cb) {
  var index = u.indexOf(partitionRanges, doc[partitionByKey])
  return cb(null, index)
}

var multiStream = new MultiFork(outputStreams.length, {
  classifier: classifier
})

for (var index in multiStream.streams) {
  multiStream.streams[index].pipe(outputStreams[index])
}

_(docs).pipe(multiStream)
