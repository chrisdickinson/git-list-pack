module.exports = until

var zlib = require('zlib')
  , through = require('through')
  , Buffer = require('buffer').Buffer

function until(size, ready) {
  var stream = through(write, end)
    , accum = new Buffer(0)
    , last_offset = 0
    , offset = 0
    , finished = false

  if(ready) {
    stream
      .on('error', ready)
      .on('data', function(d) {var x = ready; ready = function(){}; x(null, d) })
  }

  return stream

  function write(buf) {
    if(finished) {
      return
    }
    offset += buf.length
    accum = Buffer.concat([accum, buf], offset)
    stream.pause()
    attempt()
  }

  function end() {

  }

  function attempt() {
    var current = offset - last_offset
      , idx = last_offset
      , result

    backward()

    function backward() {
      zlib.inflate(accum.slice(0, current + last_offset), gotzlib)

      function gotzlib(err, data) {
        if(err || data.length < size) {
          idx = current + last_offset
          return forward()
        }
        current >>>= 1
        if(!current) {
          idx = current + last_offset
          return forward()
        } 
        backward()
      }
    }

    function forward() {
      if(idx === offset) {
        return done()
      }

      zlib.inflate(accum.slice(0, idx), function(err, data) {
        if(err || data.length < size) {
          ++idx
          return forward()
        }
        result = data
        done() 
      })
    }

    function done() {
      var old_last_offset = last_offset
      last_offset = idx
      if(finished) {
        return
      }
      if(!result) {
        return stream.resume()
      }
      finished = true

      var off = 1
      if(accum[idx] === 0xcb) {
        off = 0
      }
      stream.queue({
        compressed: idx + off
      , rest: accum.slice(idx + off)
      , data: result
      })
      stream.queue(null)
      stream.resume()
    }
  }
}
