'use strict'

const fs              = require('fs-extra')
const path            = require('upath')
const pluralize       = require('inflection').pluralize

module.exports = class File  {
  constructor (filepath, sourceDir) {
    this.filepath = filepath
    this.sourceDir = sourceDir
    this.root = sourceDir.substring(sourceDir.lastIndexOf('/') + 1)

    // Initialize "contextualizing recipe" array
    // * it is the sequence of "step" objects
    // * each object consist of two functions ...
    //      ... one `stepDO()` and it's dual `stepUNDO()`
    // * when "contextualizing" all `stepDO()` are called in array order
    // * when "uncontextualizing" all `stepUNDO()` are called in reverse order
    //
    this.recipe = []

    this.setPath()
  }

  initialize (plugin, pluginConfig) {
    this.type = plugin.filetype
    this.typePlural = pluralize(this.type)

    // Inject plugin methods
    this.functions = {}
    Object.assign(this.functions, plugin)

    // Default to synchronous. Plugin could override. Affects `this.squeezed` flag
    this.isPluginAsynchronous = false

    // Set up the "contextualizing recipe" steps in `this.recipe`
    this.addRecipeSteps()

    // `file` object ready!
    // ... do first content extraction to populate it
    this.squeeze()
  }

  setPath () {
    this.path = {
      full: this.filepath,
      relative: this.filepath.replace(this.sourceDir, ''),
      processRelative: path.relative(process.cwd(), this.filepath)
    }

    Object.assign(this.path, path.parse(this.path.relative))
  }

  addRecipeSteps () {
    // Injection to "contextualizing recipe" steps happens on three levels
    // ... precedende order: core file, filetypes and plugins
    //
    // core file: Only `File class` and appication `file.js` should override
    this.coreFileSteps()
    // Filetype: Only default filetypes and custom filetypes should override
    this.filetypeSteps()
    // Plugins: Only plugins should override
    // TODO: future feature. Plugins will have it's own overrides too!
    this.pluginSteps()
  }

  coreFileSteps () {
    // Define the contextualize first DO step (and last UNDO step together)
    this.recipe.push({
      stepDO (ctx) {
        var current = ctx

        //TODO: Verify the need to `.replace(/\\/g, '/')`
        // split path in array of directories (linux or winOS dir separators OK)
        var pathArray = this.path.dir.replace(/\\/g, '/').split('/')

        pathArray[0] = this.root

        // initialize context nested properties if do not exist already
        pathArray.forEach(dir => {
          if (dir === '') return // ignore any empty elements caused by split
          if (!current[dir]) current[dir] = {}
          current = current[dir]
        })

        // Add it as named key with the base filename for easy acces ...
        // ... Example: context.foo.bar.baz['myfile.yml']
        current[this.path.base] = this

      }, stepUNDO (ctx) {
        var current = ctx

        //TODO: Verify the need to `.replace(/\\/g, '/')`
        // split path in array of directories (linux or winOS dir separators OK)
        var pathArray = this.path.dir.replace(/\\/g, '/').split('/')

        pathArray[0] = this.root

        // initialize context nested properties if do not exist already
        pathArray.forEach(dir => {
          if (dir === '') return // ignore any empty elements caused by split
          if (!current[dir]) current[dir] = {}
          current = current[dir]
        })

        // we are UNDOING so first remove named key
        delete current[this.path.base]

        // Here comes the fun part, remove recursevely upwards to 'root'
        // TODO: remove recursevely upwards to 'root' (to not leave debris)
      }

    })
  }

  filetypeSteps () {
    // Define the contextualize DO step (and UNDO step together)
    this.recipe.push({
      stepDO (ctx) {

        // Add file to context in corresponding file type array
        ctx[this.typePlural].push(this)
        // Create named key for easy access also
        ctx[this.typePlural][this.keyName()] = this

      }, stepUNDO (ctx) {

        // Remove named keys from corresponding file type array
        delete ctx[this.typePlural][this.keyName()]
        // Remove file also
        ctx[this.typePlural] = ctx[this.typePlural].filter(f => f.path.full !== this.path.full)

      }

    })
  }

  // TODO: future feature. Plugins will have it's own overrides too!
  pluginSteps () {
    // no-op, could be overridden by each plugin as needed
    // this place holder exist for those plugins that don't need, nor include it
  }

  squeeze () {
    this.squeezed = false
    this.getContent()

    // Flag we are done squeezeing unless plugin is Asynchrounous ...
    // ... then plugin will take care of the flag when done
    if (!this.isPluginAsynchronous) this.squeezed = true
  }

  getContent () {

    // Get FS content about the file like FS stats
    this.getFScontent()

    // Read the file to fill `this.input` to have something to parse except ...
    // ... for cases where no read() is desirable like "images" and ...
    // ... "unknowns" or cases where the read() is better performed inside ...
    ///... the plugin like  "datafiles" and "scripts"
    this.read()

    // Execute plugin parse, if any
    if (this.functions.parse)
        this.functions.parse(this, this.parseCallback.bind(this))

    // Set `this.isRenderable` when plugin has injected a `render()`
    //  Means, file could (and should) be rendered to be shown or written
    this.isRenderable = (this.functions.render)

  }

  getFScontent () {
    // To have some meta content about the file
    this.stats = fs.statSync(this.path.full)
  }

  read () {
    // Method not used in `datafile`, `image` and `unknown` file types
    // This place holder could be overriden in `stylesheet`, `script` ...
    // ... file types to read file like this:
    //
    // this.input = fs.readFileSync(this.path.full, 'utf8')
  }

  parseCallback (err, output) {
    // Method overriden when parse should not output or should go to ...
    // ... other place like `this.data` (for example in file type `datafile`)

    // Parse error handling
    //
    // 1) Notes:
    //
    //    Beware this parseCallback() is commonly overriden so do not code here
    //
    //    Code where the override is (ex: `lib/filetypes/datafile.js`)
    //
    //    Code shown here only for convenience
    //    (replace `if (err) throw err` line with commented code)
    //
    // 2) SyntaxError in parse() are common due to user input error so they ...
    //    ... can be handled with code like this:
    //
/*
if (err) {
  // Only syntax error are handled
  if (!(err instanceof SyntaxError)) throw err

  let errorMessage = err + '. File was not parsed.'
  // Let the user know the reason that `this.data` will be an error message
  console.log(
`
${err} inside file: ${this.path.relative}
WARNING: There was an error parsing, so parse result was set to an error text, as:
...['${this.path.relative}'].data = "${errorMessage}"
Continue...
`
  )
  output = errorMessage
}
*/
    if (err) throw err

    this.output = output
  }

  recipeDO(ctx) {
    // Call each (function) step in "DO" recipe when adding a file to ...
    // ... contextualize it
    this.recipe.forEach(step => step.stepDO.call(this, ctx))
  }

  recipeUNDO(ctx) {
    // Call each (function) step backwards in "UNDO" recipe when deleting ...
    // ... a file to DEcontextualize it
    this.recipe.reverse().forEach(step => step.stepUNDO.call(this, ctx))
  }

  keyName () {
    return this.path.relative
  }

}
