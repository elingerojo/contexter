'use strict'

const fs              = require('fs-extra')
const path            = require('upath')
const pluralize       = require('inflection').pluralize

module.exports = class File  {
  constructor(filepath, sourceDir) {
    this.filepath = filepath
    this.sourceDir = sourceDir
    // TODO: Consider exposing `this.root` as an option from application
    this.root = '/'
    this.recipe = []
    this.setPath()
  }

  initialize (plugin, pluginConfig) {
    this.type = plugin.filetype
    this.typePlural = pluralize(this.type)

    // Modify root default if plugin root config present
    this.root = pluginConfig.root || this.root

    // Inject plugin methods
    this.functions = {}
    Object.assign(this.functions, plugin)

    // Default to synchronous. Plugin could override. Affects `this.squeezed` flag
    this.isPluginAsynchronous = false

    // Set up the contextualize "recipe" steps in `this.recipe`
    this.addRecipeSteps()

    // `file` object ready!
    // ... do first content extraction to populate it
    this.squeeze()
  }

  setPath() {
    this.path = {
      full: this.filepath,
      relative: this.filepath.replace(this.sourceDir, ''),
      processRelative: path.relative(process.cwd(), this.filepath)
    }

    Object.assign(this.path, path.parse(this.path.relative))
  }

  addRecipeSteps () {
    // Injection to contextualize "recipe" steps happens on three levels
    // ... precedende order: Core File, Filetypes and Plugins
    //
    // Core File: Only `File class` and appication `file.js` should override
    this.coreFileSteps()
    // Filetype: Only default filetypes and custom filetypes should override
    this.filetypeSteps()
    // Plugins: Only plugins should override
    // TODO: future feature. Plugins could have it's own overrides too!
    this.pluginSteps()
  }

  coreFileSteps () {
    // Define the contextualize first DO step (and last UNDO step)
    this.recipe.push({
      ctxDO (ctx) {
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

      },

      ctxUNDO (ctx) {
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
        // TODO: remove recursevely upwards to 'root'
      }

    })
  }

  filetypeSteps () {
    // Define the contextualize DO step (and UNDO step)
    this.recipe.push({
      ctxDO (ctx) {

        // Add file to context in corresponding file type array
        ctx[this.typePlural].push(this)
        // Create named key for easy access also
        ctx[this.typePlural][this.keyName()] = this

      },

      ctxUNDO (ctx) {

        // Remove named keys from corresponding file type array
        delete ctx[this.typePlural][this.keyName()]
        // Remove file also
        ctx[this.typePlural] = ctx[this.typePlural].filter(f => f.path.full !== this.path.full)

      }

    })
  }

  // TODO: future feature. Plugins could have it's own overrides too!
  pluginSteps () {
    // no-op, could be overridden by each plugin as needed
    // this place holder exist for those plugins that don't need, nor include it
  }

  squeeze () {
    this.squeezed = false
    this.setStats()
    this.getContent()

    // We are done squeezeing unless plugin is Asynchrounous and it takes ...
    // ... care of the flag
    if (!this.isPluginAsynchronous) this.squeezed = true
  }

  setStats () {
    this.stats = fs.statSync(this.path.full)
  }

  getContent () {

    // Read the file to fill `this.input` to have something to parse except ...
    // ... for cases where no read() is desirable like "images" and ...
    // ... "unknowns" or cases where the read() is better performed inside ...
    ///... the plugin like  "datafiles" and "scripts"
    this.read()

    // Execute plugin parse, if any
    if (this.functions.parse)
        this.functions.parse(this, this.parseCallback.bind(this))

  }

  read () {
    // Method overriden in `datafile`, `image` and `unknown` file types
    this.input = fs.readFileSync(this.path.full, 'utf8')
  }

  parseCallback (err, output) {
    // Method overriden when parse should not output or should go to ...
    // ... other place like `this.data` (for example in file type `datafile`)
    if (err) throw err

    this.output = output
  }

  contextualizeDO(ctx) {
    // Call each (function) step in "DO" recipe when adding a file to ...
    // ... contextualize it
    this.recipe.forEach(step => step.ctxDO.call(this, ctx))
  }

  contextualizeUNDO(ctx) {
    // Call each (function) step backwards in "UNDO" recipe when deleting ...
    // ... a file to DEcontextualize it
    this.recipe.reverse().forEach(step => step.ctxUNDO.call(this, ctx))
  }

  keyName () {
    return this.path.relative
  }

}
