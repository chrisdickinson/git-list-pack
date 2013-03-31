module.exports = until

var zlib = require('zlib')
  , Buffer = require('buffer').Buffer

function until(size) {
  var accum = new Buffer(0)
    , last_offset = 0
    , offset = 0
    , finished = false
    , data_crc = null

  return function write(buf, ready) {
    if(finished) {
      return
    }
    offset += buf.length
    accum = Buffer.concat([accum, buf], offset)
    attempt(ready)
  }

  function end() {

  }

  function attempt(ready) {
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
          idx = last_offset
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
        check_adler()
      })
    }

    function check_adler() {
      var crc
        , s1
        , s2

      if(data_crc === null) {
        s1 = 1
        s2 = 0
        for(var i = 0; i < size; ++i) {
          s1 = (s1 + result.readUInt8(i)) % 65521
          s2 = (s2 + s1) % 65521
        }
        data_crc = ((s2 << 16) | s1) >>> 0
      }

      for(var i = 0, len = accum.length - idx - 4; i < len; ++i) {
        crc = accum.readUInt32BE(idx + i)

        if(crc === data_crc) {
          break
        }
      }

      if(i === len) {
        result = null
        return done()
      }
      idx = idx + i + 4
      done()
    }

    function done() {
      var old_last_offset = last_offset

      last_offset = idx
      if(finished) {
        return ready()
      }
      if(!result) {
        return ready()
      }
      finished = true

      ready({
        compressed: idx
      , rest: accum.slice(idx)
      , data: result
      })
    }
  }
}
