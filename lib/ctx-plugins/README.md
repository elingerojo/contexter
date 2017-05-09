# Plugins API

## Overview
A plugin is a module that exports an **Object** with **functions** and **parameters** to process a particular file type (like `datafiles`, `images`, `stylesheets`, etc.)

##### functions

- `check()` - Function that calls back with a result indicating whether this plugin should process the given file
- `parse()` - Function that interprets/extracts file data
- `render()` - Function that could be externally called to present file data (Ex. by `express` server to answer a file `GET` HTTP request directly)

##### parameters

- `filetype` - File type that the plugin serves
- `priority` - To establish plugins precedence
- `watchExtensions` - Array of possible handled extensions by plugin

## Details by example

### check() and watchExtensions

Example from `ctx-datafile.js`

```js
  ...
  // Used to add watch file 'globs' patterns for watch optimization
  watchExtensions: ['.json', '.yml', '.yaml'],

  // calls back with a result indicating whether this class should process the given file.
  check (filename, callback) {
    const extension = path.extname(filename).toLowerCase()
    const allowedExtensions = this.watchExtensions

    return callback(null, allowedExtensions.indexOf(extension) > -1)
  },
  ...
```

- `check(filename, callback(err, result))` _(Function)_ - Mandatory - The result of the function is used to determine whether the plugin should process a particular file or not

    - Receives a `filename`. It is a full path to the file including name and extension

    - Returns a callback function with signature `(err, result) => {}`

        - `result` is a `String` or `Boolean` indicating whether the plugin should process the given file. If it is a `String`, it is evaluated as `true`, meaning that the plugin should process the file. And the string value will be used as the "target file extension" used by _write-like-process_ like `render()`. If it is a `Boolean` (and `true`), the original `filename` extension will be used as the "target file extension"


- `watchExtensions` _(Array)_ - Optional - array with extensions to "narrow" (and optimize) the file watch. When absent, watch glob optimization does not occur and watch happens on ALL files in directory even for those that do not have a corresponding plugin (so they will end unprocessed as `unknowns`)


Example returning a `String` (from plugin `ctx-page.js`, an application that process website pages, not present in `npm contexter` but shown for didactic purpose)

```js
  ...
  // Used to add watch file 'globs' patterns for watch optimization
  watchExtensions: ['.html', '.md', '.mdown', '.markdown', '.handlebars', '.hbs'],

  // calls back with a result indicating whether this class should process the given file.
  check (filename, callback) {
    const extension = path.extname(filename).toLowerCase()
    const allowedExtensions = this.watchExtensions
    let isFound = allowedExtensions.indexOf(extension) > -1
    // if original file extension is in the list, the `render()` output should be '.html'
    return callback(null, isFound ? '.html' : false)
  },
  ...
```

---

### parse()

Example from `ctx-datafile.js`

```js
  ...
  parse (file, callback) {
    var data = null

    function isJSON () {
      return file.path.ext.toLowerCase() === '.json'
    }

    function isYML () {
      var ext = file.path.ext.toLowerCase()
      return ext === '.yml' || ext === '.yaml'
    }

    if (isJSON()) {
      // if not the first time, delete cache
      if (file.data) delete require.cache[require.resolve(file.path.full)]
      data = require(file.path.full)
    }

    if (isYML()) data = yaml.safeLoad(fs.readFileSync(file.path.full, 'utf8'))

    return callback(null, data)
  }
  ...
```

- `parse (file, callback(err, data))` _(Function)_ - Optional - The data of the call back function is added to the `context` object in the property (and level) that the `filetype` defines (see Filetypes API)

    - Receives a `file` object. It is an instance of the `filetype` class that the plugin serves

    - Returns a callback with the signature  `function (err, data) {}`

        - `data` is the processed file data to be added to `context` object

---

### render()


- Example from an application that process stylesheets (plugin `app-stylesheet.js` not present in `npm contexter` but shown for didactic purpose)



```js
const myth            = require('myth')
const less            = require('less')
const sass            = require('node-sass')
const stylus          = require('stylus')

  . . .
  render (context, callback) {
    const file = this
    var output

    if (file.isCSS) {
      output = myth(file.input, {source: file.path.full})
      return callback(null, output)
    }

    if (file.isLess) {
      return less.render(file.input, {filename: file.path.full}, function(err, output){
        if (err) throw err
        return callback(null, output.css)
      })
    }

    if (file.isStylus) {
       output = stylus(file.input)
        .set('filename', file.path.full)
        .set('paths', [path.dirname(file.path.full)])
        .render()
      return callback(null, output)
    }

    if (file.isSass) {
      output = sass
        .renderSync({data: file.input, indentedSyntax: true})
        .css
        .toString('utf8')
      return callback(null, output)
    }

    if (file.isSCSS) {
      output = sass
        .renderSync({data: file.input})
        .css
        .toString('utf8')
      return callback(null, output)
    }

    return callback(null, file.input)
  }
  . . .
```

- `render (file, callback(err, output))` _(Function)_ - Optional - The `output` of the call back function is the processed file data for final presentation

    - Receives a `file` object. It is an instance of the `filetype` class that the plugin serves

    - Returns a callback with the signature  `function (err, output) {}`

        - `output` is the processed file data for final presentation (that could be used by `express` server in response to a `GET` HTTP request)

---

### priority

```js
  . . .
  // Check precedence: higher first to lower last
  priority: 30,
  . . .
```

- `priority` _(Number)_ - Optional - It is used to define the `check()` function precedence between plugins when conflicting plugins are present. Conflicting means, an overlap of the filetypes they serve.

---

### filetype

Example from a plugin that serves `script` file types (not present in `npm contexter` but shown for didactic purpose)

```js
  . . .
  // Mandatory string with the name of the file type the plugin serves
  filetype: 'script',
  . . .
```

- `filetype` _(String)_ - Mandatory - **exact** filetype name that the plugin serves
