var fs = require('fs')
  , unpack = require('./index')
  , through = require('through')
  , EE = require('events').EventEmitter

var map = {}
  , ev = new EE

fs.createReadStream('client-output')
  .pipe(through())
  .pipe(unpack())
  .on('data', function(data) {
    console.log('GOT', data.offset)
  })
