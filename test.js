var parse_offsets = require('./index') 
  , packfile = require('./test-fixture')
  , expected = require('./reference')
  , through = require('through')
  , test = require('tape')

test('works as expected', function(assert) {
  var offsets = parse_offsets()
    , reference = expected.split('\n')
    , idx = 0

  offsets
    .pipe(through(check))
    .on('end', function() { assert.end() })

  setTimeout(function() {
    offsets.write(packfile)
    offsets.end()
  }, 0)

  function check(info) {
    assert.equal(''+info.offset, reference[idx++], info.offset+' should === '+reference[idx-1])
  }
})
