module.exports = unpack 

var through = require('through')
  , apply_delta = require('git-apply-delta')
  , Buffer = require('buffer').Buffer
  , inflate = require('./inflate-until')
  , concat = require('concat-stream')

var _ = -1 
  , STATE_HEADER_SIG = ++_
  , STATE_HEADER_VERSION = ++_
  , STATE_HEADER_OBJECT_COUNT = ++_
  , STATE_OBJECT_HEADER = ++_
  , STATE_OBJECT = ++_
  , STATE_OBJECT_OFS_DELTA = ++_
  , STATE_OBJECT_REF_DELTA = ++_
  , STATE_INFLATE = ++_
  , STATE_BUFFERING = ++_
  , STATE_TRAILER_CKSUM = ++_

var STATES = [
    'STATE_HEADER_SIG'
  , 'STATE_HEADER_VERSION'
  , 'STATE_HEADER_OBJECT_COUNT'
  , 'STATE_OBJECT_HEADER'
  , 'STATE_OBJECT'
  , 'STATE_OBJECT_OFS_DELTA'
  , 'STATE_OBJECT_REF_DELTA'
  , 'STATE_INFLATE'
  , 'STATE_BUFFERING'
  , 'STATE_TRAILER_CKSUM'
]

var OFS_DELTA = 6
  , REF_DELTA = 7

function unpack(find) {
  var stream = through(write_, end)
    , state = STATE_HEADER_SIG
    , should_break = false
    , buffer = []
    , accum = []
    , got = 0
    , expect
    , all

  var inflate_until

  var version
    , offset = 0
    , header_size = 0
    , object_count
    , expanded_size
    , last_object
    , reference
    , last_type
    , type
    , cksum

  var want = 4 

  return stream

  function write_(buf) {
    write(buf)
  }

  function end(buf) {
  }

  function write(buf) {
    while(!should_break && buf.length) {
      switch(state) {
        case STATE_HEADER_SIG: buf = read_signature(buf); break
        case STATE_HEADER_VERSION: buf = read_version(buf); break
        case STATE_HEADER_OBJECT_COUNT: buf = read_object_count(buf); break
        case STATE_OBJECT_HEADER: buf = read_object_header(buf); break
        case STATE_OBJECT_OFS_DELTA: buf = read_ofs_delta(buf); break
        case STATE_OBJECT_REF_DELTA: buf = read_ref_delta(buf); break
        case STATE_OBJECT: buf = read_object(buf); break
        case STATE_INFLATE: buf = read_inflate(buf); break
        case STATE_BUFFERING: buffer.push(buf); should_break = true; break
        case STATE_TRAILER_CKSUM: buf = read_cksum(buf); break
      }
    }
    should_break = false
  }

  function read_signature(buf) {
    if(got === 4) {
      if((Buffer.concat(accum, 4)+'') !== 'PACK') {
        stream.emit('error', new Error('invalid header'))
        return []
      }
      become(STATE_HEADER_VERSION)
      return buf
    }
    return take(4 - got, buf)
  }

  function read_version(buf) { 
    if(got === 4) {
      version = Buffer.concat(accum, got).readUInt32BE(0)
      become(STATE_HEADER_OBJECT_COUNT)
      return buf
    }    
    return take(4 - got, buf)
  }

  function read_object_count(buf) {
    // read object count
    if(got === 4) {
      expect = object_count = Buffer.concat(accum, got).readUInt32BE(0)
      become(expect ? STATE_OBJECT_HEADER : STATE_TRAILER_CKSUM)
      return buf
    }    
    return take(4 - got, buf)
  } 

  function read_object_header(buf) {
    var byt = buf.readUInt8(0)
    if(!(byt & 0x80)) {
      accum.push(buf.slice(0, 1))
      ++got

      var expanded_size_array = toarray(Buffer.concat(accum, got))
        , size = expanded_size_array[0] & 0x0F
        , shift = 4
        , idx = 1

      byt = expanded_size_array[0]
      type = byt >> 4 & 7

      while(idx < expanded_size_array.length) {
        size += (expanded_size_array[idx++] & 0x7F) << shift
        shift += 7
      }

      ++header_size
      expanded_size = size
      become(type < 5 ? STATE_OBJECT :
             type === OFS_DELTA ? STATE_OBJECT_OFS_DELTA :
             type === REF_DELTA ? STATE_OBJECT_REF_DELTA : STATE_OBJECT_HEADER)

      return buf.slice(1) 
    }
    return take(1, buf, true)
  }

  function read_ofs_delta(buf) {
    if(got >= 1) {
      var byt = accum[accum.length - 1].readUInt8(0)
        , buffer

      if(!(byt & 0x80)) {
        become(STATE_INFLATE)
        inflate_until = inflate(expanded_size, got_inflate)
        return buf
      }
    }
    return take(1, buf, true)
  }

  function read_ref_delta(buf) {
    if(got === 20) {
      reference = Buffer.concat(accum, got)
      inflate_until = inflate(expanded_size, got_inflate)
      become(STATE_INFLATE)
      return buf
    }
    return take(20 - got, buf, true)
  }

  function read_object(buf) {
    inflate_until = inflate(expanded_size, got_inflate)
    become(STATE_INFLATE)
    return buf
  }
  
  function got_inflate(info) {
    last_type = type

    stream.queue(last_object = {
        type: last_type
      , offset: offset
      , data: info.data
      , compressed: info.compressed
      , header_size: header_size
    })

    offset += info.compressed + header_size
    become(--expect ? STATE_OBJECT_HEADER : STATE_TRAILER_CKSUM)
    header_size = 0

    buffer.unshift(info.rest)
    while(buffer.length && state !== STATE_BUFFERING) {
      write(buffer.shift())
    }
  }

  function read_inflate(buf) {
    become(STATE_BUFFERING)
    inflate_until(buf, function(info) {
      if(info) {
        return got_inflate(info)
      }
      become(STATE_INFLATE)
      if(buffer.length) {
        write(buffer.shift())
      }
    })
    should_break = true
    return []
  }

  function read_cksum(buf) {
    if(got === 20) {
      // and we've got the checksum
    }
    return take(20 - got, buf)
  }

  function become(st) {
    got =
    accum.length = 0
    state = st
  }

  function take(n, buf, noincr) {
    var upto = Math.min(buf.length, n)
    accum.push(buf.slice(0, upto))
    got += upto
    if(!noincr) offset += upto
    else header_size += upto
    return buf.slice(upto)
  } 
}

function toarray(buf) {
  var arr = []
  for(var i = 0, len = buf.length; i < len; ++i) {
    arr[i] = buf.readUInt8(i)
  }
  return arr
}

function pad(n) {
  while(n.length !== 8) {
    n = '0'+n
  }
  return n
}
