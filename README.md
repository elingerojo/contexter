[![travis-badge](https://travis-ci.org/elingerojo/contexter.svg?branch=master)](https://travis-ci.org/elingerojo/contexter)

# contexter

> Reactively extract all available data from files in a directory to one javascript object

![dir-to-jsobject-240x80](https://cloud.githubusercontent.com/assets/4935817/24068707/dde7f2ae-0b63-11e7-9381-f7adac714c8e.png)


Contexter reactively builds a context object from the data and metadata available in files in a directory for easy manipulation. It mirrors the directory structure and selectively extracts data depending on file type. Watches for any change in directory to keep the javascript object continuously update

## Usage

Sample dir structure

    dir/
    |-- assets/
    |   |-- photo.jpg
    |   |-- style.css
    |   `-- posts.yml   <--- contains foo:"bar"
    |
    |-- index.html
    |-- README.md
    `-- notes.txt

**myApp.js**

```javascript
const Contexter= require('contexter')

const ctxr = new Contexter()

ctxr.watcher('path-to-dir')
  .on('ready', context => {
    console.log( context['/'].assets['posts.yml'].data.foo )
  })
```

**console output**

```c
> "bar" // value `foo:"bar"` inside `posts.yml`
> "BAZ" // . . . value after editing to `foo:"BAZ"` in `posts.yml`
> . . .   // reactively display any update to files in `dir`
```

The result is a reactive `context` variable equivalent to:

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

- The directory structure is mirrored in property `"/"` with all files and it's data directly available
- For extra convenience...
    - All data files are **also** available as an array in sibling property `datafiles`
    - Files with extension like datafiles but not able to process them are available as an array on next sibling property `unknowns`

#### Description

There are two file types. Files with extensions `.json`, `.yml` and `.ymal` are `datafiles` type and those that can not be processed are `unknowns` type

Each datafile appears twice in `context` object

1. Under the property `"/"` in the corresponding nested level according with the directory structure
2. Under the corresponding file type property. Either `datafiles` or `unknowns`

In the `context` object, a `file` is represented by a property named after the filename including the extension. For example: file `posts.yml` is the property '"posts.yml"' of the object `assets`

The `file` value is an object that contains a property (among others) named `data` with the data values of the parsed content of the file.

This `file` object also has another properties representing **metadata** about the file, properties like `path`and `stats`

- `path.full`: Full path file
- `path.relavive`: file path relative to dir provided
- `path.processRelative`: file path relative to `process.cwd()`
- ...and all `path` properties from `path.parse()` from the [npm upath](https://www.npmjs.com/package/upath)
- ...and all `stats` properties from `fs.statSync()` from the [npm fs-extra](https://www.npmjs.com/package/fs-extra)

#### Customization

There are 2 configuration options

1. For `Contexter(config)`
2. For `.watcher(options)`

`config`: Object with `Contexter` configuration
- `config.reportInterval`: Number representing the interval milliseconds to report the remaining files to `context` be ready. Commonly used to keep the user informed that files are been processed. Affects `contexting` and `all` events. Default to  `0` (zero) meaning that reporting is disabled.
- `config.pluginConfig`: Object with `plugin` configuration (see Advanced Methods below)

`options`: Object with [chokidar](https://github.com/paulmillr/chokidar#api) options

The `context` object format and content can be custom redefined

- Custom file **types** could be **extended** beyond the `datafile` default type, example: `images`, `stylesheets`,... (see Advanced Methods below)

- Custom file **processes** could be **used** beyond data file `JSON` and `yaml` parse, example: `render`, `write`,... (see Advanced Methods below)

## Getting started

(You may prefer to test drive [contexter-cli](https://www.npmjs.com/package/contexter-cli), a sample application using `contexter` that easily can be used from command line)

Install with npm:

    npm install contexter --save

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

## API

`ctxr.watcher(path, [options])`

* `path` (string). Path to dir to be watched recursively
* `options` (object)
    - All options from  [chokidar](https://github.com/paulmillr/chokidar#api) are passed directly
    - `pluginConfig`: One additional option special for plugin configuration. One object with following properties
        - `pluginConfig.targetDir`: Full directory path where file should be render or written
        - `pluginConfig.targetExt`: File extension that should be used for render or writing the file
        - `pluginConfig.root`: String to replace the default `'/'` property name

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
2. **Filetype**: Methods that could be replaced by `filetype` object to "extend" `file` capabilities like the content and format of the `context` object to suit `datafiles` or custom file types
3. **Plugin**: Methods that could be replaced by `plugin` object to "use" different `file` process like different parsers or to custom render results from the parsed files

`extend(filetypeName, filetype)`: Extends the File class to have other file types beyond `datafiles` or even modify the `context` object structure and format

  - filetypeName: String used as a reference for the `filetype` object inside plugins
  - filetype: Object with methods that replace the some of the original `file` class methods. Used to define de `context` format

`use(plugin)`: Extend the File class to have other file process beyond data file `JSON` and `yaml` parse. Custom processes like `render` and `write`

- `plugin`: Object with methods that replace some of the original `file` class methods

See detail information [here](./lib/ctx-plugins/README.md)

## Acknowledgements

- [@zeke](https://www.npmjs.com/~zeke) Thanks for your code, time and inspiration

## License

The MIT License (MIT)

Copyright (c) 2017 Eduardo Martinez

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
