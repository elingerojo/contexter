[![travis-badge](https://travis-ci.org/elingerojo/contexter.svg?branch=master)](https://travis-ci.org/elingerojo/contexter)

# contexter

> Reactively extract all available data from files in a directory to one javascript object

![dir-to-jsobject-240x80](https://cloud.githubusercontent.com/assets/4935817/24068707/dde7f2ae-0b63-11e7-9381-f7adac714c8e.png)


Contexter reactively builds a context object from the data and metadata available in files in a directory for easy manipulation. It mirrors the directory structure and selectively extracts data depending on file type. Watches for any change in directory to keep the javascript object continuously updated

(You may prefer to test drive `contexter` with [contexter-cli](https://www.npmjs.com/package/contexter-cli) sample application that can easily be used from command line)

## Usage

Sample dir structure:

    dir/
    |-- assets/
    |   |-- photo.jpg
    |   |-- style.css
    |   `-- posts.yml   <--- contains foo:"bar"
    |
    |-- index.html
    |-- README.md
    `-- notes.txt

In your code:

```js
var Contexter = require('contexter');

var ctxr = new Contexter();

ctxr.watcher('./dir')
  .on('ready', function (context) {
    console.log( context['/'].assets['posts.yml'].data.foo );
  });
```

output:

```c
> "bar" // value `foo:"bar"` from inside `posts.yml`
> "BAZ" // ... value after editing to `foo:"BAZ"` in `posts.yml`
> ...   // reactively display any update to files in `./dir`
```

The result is a reactive `context` variable equivalent to:

```js
var context = {
              "/": {
                    assets: {
                          "posts.yml": {
                                data: {foo: "bar", ...}, ...
                          }}
                    },
              datafiles: [
                    {...}   // posts.yml
                    ],
              unknowns: [
                    ]      // empty
            }
```

- The directory structure is mirrored in property `"/"` with all data files, it's data and metadata directly available
- For extra convenience...
    - All data files are **also** available as an array in sibling property `datafiles`
    - Files with extension like data files but not able to be processed, are available in an array in next sibling property `unknowns`

#### Description

There are two file types. Files with extensions `.json`, `.yml` and `.ymal` are `datafile` type and those that can not be processed are `unknown` type

Each datafile appears twice in `context` object

1. Under the property `"/"` in the corresponding nested level according with the directory structure
2. Under the corresponding file type property. Either `datafiles` or `unknowns`

In the `context` object, a `file` is represented by a property named after the filename including the extension. For example: file `posts.yml` is the property `"posts.yml"` of the object `assets`

The `file` value is an object that contains a property (among others) named `data` with the data values of the parsed content of the file.

This `file` object also has other properties representing **metadata** about the file, properties like `path` and `stats`

`.data` properties samples:

- `.path.full`: Full path file
- `.path.relative`: file path relative to directory provided
- `.path.processRelative`: file path relative to `process.cwd()`
- ...and all `path` properties from `upath.parse()` function from the [npm upath](https://www.npmjs.com/package/upath)
- ...also, all `stats` properties from `fs.statSync()` from the [npm fs-extra](https://www.npmjs.com/package/fs-extra)

#### Configuration and options

1. For `Contexter(config)`
2. For `.watcher(path, options)`

`config`: Object for `Contexter(config)` configuration

- `config.reportInterval`: Number representing the interval milliseconds to report the remaining files to `context` be ready. Commonly used to keep the user informed that files are been processed. Affects `contexting` and `all` events. Default to  `0` (zero) meaning that reporting is disabled.
- `config.isWatchAll`: Boolean to set file watch mode. There are two mode: `true` for "dir path" and `false` for "glob optimized". The first one, watch for ALL files in the directory specified, the later one, optimize a `glob` to watch ONLY for files with their extensions stated in the plugins. Default to false, meaning: "glob optimized" to ONLY watch for a "narrow" set of files
- `config.pluginConfig`: Object with global `plugin` configuration (see API below)

`options`: Object for `.watcher(path, options)`

- All [chokidar.watch()](https://github.com/paulmillr/chokidar#api) options pass directly to underlying `chokidar.watch()`

#### context object format (and content)

The `context` object format and content can be custom redefined

- Custom file **types** could be **extended** beyond the `datafile` default type, example: `image`, `stylesheet`,... (see Advanced Methods below)

- Custom file **processes** could be **used** beyond data file `JSON` and `yaml` parse, example: `render` or other parsers (see Advanced Methods below)

## Getting started

Install with npm:

```
$ npm install contexter --save
```

Then `require` and use it in your code:

```javascript
const Contexter= require('contexter')

const ctxr = new Contexter()

// Example of a typical implementation structure:

// Initialize watcher.
var sentinel = ctxr.watcher('path-to-dir', {
  ignored: /(^|[\/\\])\../ // ignore dot files (filename beginning with a dot)
});

// Something to use when events are received.
var log = console.log.bind(console);

// Add event listeners.
sentinel
  .on('ready', context => log(`context is ready with ${context.datafiles.length} datafiles`))

// More possible events.
sentinel
  .on('started', context => log(`Just started with context empty ${context['/']}`))
  .on('adding', file => log(`File ${file.path.relative} has been added`))
  .on('updating', file => log(`File ${file.path.relative} has been updated`))
  .on('deleting', file => log(`File ${file.path.relative} has been deleted`))
  .on('contexting', files => log(`Processing : ${files.length} files`))

```

(You may prefer to test drive `contexter` with [contexter-cli](https://www.npmjs.com/package/contexter-cli) sample application that can easily be used from command line)

## API

`Contexter([config])`
- `reportInterval`: Time in milliseconds between "remaining files" report (0 to disable reporting)
- `isWatchAll`: Flag to watch all files. Default to not watch all (`false` means, optimize)
- `pluginConfig`: Object with global plugin's configuration
    - `pluginConfig.targetDir`: Full directory path where file should be render or written
    - `pluginConfig.root`: String to replace the default `'/'` (see notice below example)

example:
```js
var Contexter = require('contexter');

var ctxr = new Contexter({
  reportInterval: 2000, // Report remaining files every 2 sec. until all are contexted
  pluginConfig: {root: 'dir'} // Change to better root key name
});

ctxr.watcher('./dir')
  .on('ready', function (context) {
    console.log( context.dir.assets['posts.yml'].data.foo );
  });
```

Notice: `.root` will be deprecated toward similar interface one level up outside `pluginConfig` object in future releases

`ctxr.watcher(path, [options])`

* `path` (string). Path to dir to be watched recursively
* `options` (object)
    - All options from  [chokidar.watch()](https://github.com/paulmillr/chokidar#api) are passed directly

#### Events

`ctxr.watcher()` produces an instance of `event-emitter`:

* `.on(event, callback)`: Listen for an FS event.
Available events:

    - `strarting` event signature: `.on('strarting', callback(context))`
    - `contexting` event signature: `.on('contexting', callback(files))`
    - `ready` event signature: `.on('ready', callback(context))`
    - `adding` event signature: `.on('adding', callback(file))`
    - `updating` event signature: `.on('updating', callback(file))`
    - `deleting` event signature: `.on('deleting', callback(file))`

Additionally `all` event is available which gets emitted with the underlying event name for every event except `starting`. It acts as single event triggered by all other events

- `all` event signature: `.on('all', callback(ctx, eventName, payload))`
    -  `payload` is an array of `files` for `contexting`
    -  `payload` is `null` for `ready`
    -  `payload` is a single `file` for `adding`, `updating` and `deleting`

#### Advanced Methods

The default `file` class has 3 types of methods

1. **Core**: Methods common to all `file` objects
2. **Filetype**: Methods that could be replaced by `filetype` object to "extend" `file` capabilities like the content and format of the `context` object to suit `datafile` or custom file types like `image`, `stylesheet`, etc.
3. **Plugin**: Methods that could be replaced by `plugin` object to "use" different `file` process like different parsers or to custom render results from the parsed files

`.extend(filetypeName, filetype)`: Extends the File class to have other file types beyond `datafiles` or even modify the `context` object structure and format

  - filetypeName: String used as a reference for the `filetype` object inside plugins
  - filetype: Object with methods that replace the some of the original `file` class methods. Used to define de `context` format

`.use(plugin)`: Extend the File class to have other file process beyond data file `JSON` and `yaml` parse. Custom processes like `parse()` and `render()`

- `plugin`: Object with methods that replace some of the original `file` class methods

For more on advanced methods, see [overview](./lib/README.md) and [detailed](./lib/ctx-plugins/README.md) information

## Acknowledgements

- [@zeke](https://www.npmjs.com/~zeke) Thanks for your ideas, code and time

## License

The MIT License (MIT)

Copyright (c) 2017 Eduardo Martinez

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
