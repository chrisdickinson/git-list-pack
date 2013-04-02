# git-list-pack

given a stream of packfile contents, emit the raw git
objects contained within + their offsets.

note, this doesn't do the actual translation into *real* git objects,
rather, it'll give you the inflated data that an object represents
and its offset; likewise it skips actually applying deltas in the case
of ofs and ref delta. other modules will do that.

```javascript
var list = require('git-list-pack')

fs.createReadStream('path/to/file.pack')
  .pipe(list())
  .on('data', function(obj) {
    console.log(obj)
  })

```

## API

#### list() -> pack list stream

create a through stream of pack objects.

## "data" event

```javascript
{ reference: Array | Buffer | null // if delta, reference will contain the relevant offset data.
, data: Buffer // the inflated data
, type: 1 | 2 | 3 | 4 | 6 | 7 // the packed git object type
, offset: Number // the offset into the packfile
, num: Number } // the number of the object from expected_objects -> 0
```

## License

MIT
