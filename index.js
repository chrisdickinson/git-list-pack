module.exports = unpack

var min = require('./min')
  , through = require('through')

function unpack() {
  var stream = through(write, end)
    , inner = min(read)
    , accum = []
    , cb

  iter()

  return stream

  function iter() {
    inner(null, function(err, data) {
      if(err) {
        stream.emit('error', err)
        return
      }
      if(data === undefined) {
        stream.queue(null)
        return
      }
      stream.queue(data)
      iter()
    })
  }

  function write(buf) {
    accum.push(buf)
    if(!cb) {
      return
    }

    while(accum.length) {
      cb(null, accum.shift())
    }
  }

  function end() {
    console.log('got buf', accum.length, cb)
  }

  function read(close, callback) {
    if(close) {
      if(close === true) { 
        stream.queue(null)
      } else {
        stream.emit('error', close)
      }
      return
    }

    cb = callback
  }
}
