'use strict'

const path            = require('upath')
const chokidar        = require('chokidar')
const ee              = require('event-emitter')
const defautlPlugins  = require('require-dir')('./ctx-plugins')
const defaultTypes    = require('require-dir')('./ctx-types')
const pluralize       = require('inflection').pluralize
const Context         = require('./context')

module.exports = class Contexter {
  constructor (config) {
    if (config) {
      this.pluginConfig = config.pluginConfig || {}
    }
    // zero means, default to not report the remaining files at all
    this.reportDelay = config && config.reportDelay ? config.reportDelay : 0
    this.files = []

    // Add file types to extend basic file type, if any
    this.filetypes = defaultTypes

    this.plugins = []
    // Preload default plugins by precedence `check()` order
    Object.keys(defautlPlugins).sort((a, b) => {
      return defautlPlugins[a].priority || 0 - defautlPlugins[b].priority || 0
    }).forEach(key => {
      this.plugins.push(defautlPlugins[key])
    })
  }

  // Add custom file types by extending a `this.filetypes`
  // `.extend(name-of-filetype, file-type-object)`
  extend (filetypeName, filetype) {
    // TODO: Add some validation
    if (!this.filetypes[filetypeName]) this.filetypes[filetypeName] = {}
    // Override only those properties present in new "file-type-object"
    Object.assign(this.filetypes[filetypeName], filetype)
  }

  // Adds a custom plugins, an object with functions like ...
  // ... `check()`, `parse()`, `render()`,... to process a particular file type
  use (plugin) {
    // TODO: Add some validation
    this.plugins.push(plugin)
  }

  // powered by `chokidar`
  watcher (sourceDir, options) {
    const self = this
    const emitter = ee()
    const targetDir = this.targetDir
    const ctx = new Context(this.filetypes)
    const plugins = this.plugins.reverse()
    const isReporting = this.reportDelay !== 0 // Report every `reportDelay` ms

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

    chokidar.watch(sourceDir, options)
      .on('add', (filename) => createFile(path.normalize(filename)))
      .on('change', (filename) => updateFile(path.normalize(filename)))
      .on('unlink', (filename) => deleteFile(path.normalize(filename)))
      .on('ready', () => {
        var tryToFinishInterval

        function tryToFinish() {
          const remaining = self.files.filter(f => !f.squeezed)
          if (isReporting) {
            emitter.emit('all', ctx, 'contexting', remaining)
            emitter.emit('contexting', remaining)
          }
          if (remaining.length > 0) return
          // After initial file squeeze, the 'squeezed' flag should be set false
          // to avoid any race condition at file updates
          self.files.forEach(file => file.squeezed = false)
          emitter.emit('all', ctx, 'ready', null)
          emitter.emit('ready', ctx)
          clearInterval(tryToFinishInterval)
        }

        // wrapper function to start interval immediatly without first wait
        function startInterval(ms, callback) {
          callback();
          return setInterval(callback, ms);
        }

        // If not reporting then report at least once before start intverval
        if (!isReporting) {
          emitter.emit('all', ctx, 'contexting', self.files)
          emitter.emit('contexting', self.files)
        }
        tryToFinishInterval = startInterval(self.reportDelay, tryToFinish)
      })

    process.nextTick(function() {
      emitter.emit('started', ctx)
    })

    return emitter
  }

}
