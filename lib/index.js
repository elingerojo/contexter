'use strict'

const path            = require('upath')
const chokidar        = require('chokidar')
const ee              = require('event-emitter')
const defautlPlugins  = require('require-dir')('./ctx-plugins')
const defaultTypes    = require('require-dir')('./ctx-types')
const pluralize       = require('inflection').pluralize
const union           = require('lodash').union
const Context         = require('./context')

var allWatchExts = []

// Accumulator flag over plugins `watchExtensions` existance ...
// ... if ALL plugins have it, then a glob can be built to optimize watch
var isStillOptimizable = true

module.exports = class Contexter {
  constructor (config) {
    this.reportInterval = 0 // Default to not report while contexting
    this.isWatchAll = false // Default to not watch all (means, optimize)
    this.pluginConfig = {}

    // Override custom configuration if present
    if (config) {
      this.reportInterval = config.reportInterval || this.reportInterval
      this.isWatchAll = config.isWatchAll || this.isWatchAll
      this.pluginConfig = config.pluginConfig || this.pluginConfig
    }

    this.files = []

    // Add file types to extend basic file type, if any
    this.filetypes = defaultTypes

    this.plugins = []
    // Preload default plugins by precedence `check()` order
    Object.keys(defautlPlugins).sort((a, b) => {
      return defautlPlugins[a].priority || 0 - defautlPlugins[b].priority || 0
    }).forEach(key => this.use(defautlPlugins[key]))

  }

  // Add custom file types by creating or extending particular `this.filetypes`
  // extend API: `.extend(string-name-of-filetype, file-type-object)`
  extend (filetypeName, filetype) {
    // TODO: Add some validation
    // if do not exist already, then create it
    if (!this.filetypes[filetypeName]) this.filetypes[filetypeName] = {}
    // Override properties (some new functions overide the old ones)
    Object.assign(this.filetypes[filetypeName], filetype)
  }

  // Adds a custom plugins, an object with functions like ...
  // ... `check()`, `parse()`, `render()`,... to process a particular file type
  use (plugin) {
    // TODO: Add some validation
    this.plugins.push(plugin)
    // Accumulate all possible watch file extensions
    if (plugin.watchExtensions) {
        allWatchExts = union(allWatchExts, plugin.watchExtensions)
    }
    // Accumulate `watchExtensions` existances in plugins (except `unkonwn`)
    if (plugin.filetype !== 'unknown') {
        isStillOptimizable = isStillOptimizable && plugin.watchExtensions
    }
  }

  // powered by `chokidar`
  watcher (sourceDir, options) {
    const self = this
    const emitter = ee()
    const isReporting = this.reportInterval > 0 // Report every interval
    const reportInterval = Math.max(this.reportInterval, 200) // min threshold
    const ctx = new Context(this.filetypes)
    const plugins = this.plugins.reverse()

    var checkResult // plugins `check()` results to define target extension

    // Select the appropriate plugin for this filename using `check()`
    function selectPlugin(filename) {
      return plugins.find(plugin => {
        // save check result to define target extension
        return checkResult = plugin.check(filename, (err, result) => {
          return result
        })
      })
    }

    function createFile(filename) {
      const selectedPlugin = selectPlugin(filename) // run plugins `check()`s

      // If `check()` result is a string, means it is the target extension
      let targetExt = typeof checkResult === 'string'
        ? checkResult
        : path.extname(filename).toLowerCase()

      // Add to plugin config (mandatory, used in `setHref()` and `keyName()`)
      Object.assign(self.pluginConfig, {targetExt})

      const file
        = ctx.newFile(filename, sourceDir, selectedPlugin, self.pluginConfig)
      file.contextualizeDO(ctx)
      self.files.push(file)
      emitter.emit('all', ctx, 'adding', file)
      emitter.emit('adding', file)
    }

    function updateFile(filename) {
      var file = self.files.find(f => f.path.full === filename)
      file.squeeze()
      emitter.emit('all', ctx, 'updating', file)
      emitter.emit('updating', file)
    }

    function deleteFile(filename) {
      var file = self.files.find(f => f.path.full === filename)
      file.contextualizeUNDO(ctx)
      self.files = self.files.filter(f => f.path.full !== filename)
      emitter.emit('all', ctx, 'deleting', file)
      emitter.emit('deleting', file)
    }

    // Assemble a watch glob like `<source-dir>/**/*.{ext1,ext2,...,extn}`
    function optimizeGlob(sourceDir) {
      var watchGlob = sourceDir // Default to not optimizable (watch all dir)
      // Determine whether chokidar watch can be optimized due to ...
      // ... not custom forced to watch for all extensions and ...
      // ... `watchExtensions` were available in all plugins
      if (!self.isWatchAll && isStillOptimizable) {
        watchGlob = sourceDir + '/**/*.{'
        // Add all extensions, removing dot and separating by a comma
        allWatchExts.forEach(ext =>
            watchGlob = watchGlob.concat(ext.substr(1), ','))
        // remove last extra comma and add closing curly bracket
        watchGlob = watchGlob.slice(0, -1) + '}'
      }
      return watchGlob
    }

    chokidar.watch(optimizeGlob(sourceDir), options)
      .on('add', (filename) => createFile(path.normalize(filename)))
      .on('change', (filename) => updateFile(path.normalize(filename)))
      .on('unlink', (filename) => deleteFile(path.normalize(filename)))
      .on('ready', () => {
        var tryToFinishInterval // Holder for javascript interval reference

        function tryToFinish() {
          const remaining = self.files.filter(f => !f.squeezed)
          if (isReporting) {
            emitter.emit('all', ctx, 'contexting', remaining)
            emitter.emit('contexting', remaining)
          }
          if (remaining.length > 0) return
          clearInterval(tryToFinishInterval)
          // After initial file squeeze, the 'squeezed' flag should be set false
          // to avoid any race condition at file updates
          self.files.forEach(file => file.squeezed = false)
          emitter.emit('all', ctx, 'ready', null)
          emitter.emit('ready', ctx)
        }

        // If not reporting then report at least once before start intverval
        if (!isReporting) {
          emitter.emit('all', ctx, 'contexting', self.files)
          emitter.emit('contexting', self.files)
        }

        tryToFinishInterval = setInterval(tryToFinish, reportInterval)
      })

    process.nextTick(function() {
      emitter.emit('started', ctx)
    })

    return emitter
  }

}
