'use strict'

const pluralize       = require('inflection').pluralize
const File            = require('./file')

var filetypes

module.exports = class Context {
  constructor (_filetypes) {
    filetypes = _filetypes
    //
    //  Create holding structure like:
    //
    //   {
    //      files: [],
    //      datafiles: [],
    //      images: []
    //      ...
    //  }
    //
    // ... from the plural of all keys in filetypes, if any. Commonly, at ...
    // ... least the included basic types (folder `ctx-types`)
    Object.keys(filetypes).forEach((type) => {
      var typePlural = pluralize(type).toLowerCase()
      this[typePlural] = []
    })

  }

  // wrapper to instantiate new files per type and inject it's custom overrides
  newFile (filename, sourceDir, plugin, pluginConfig) {
    const type = plugin.filetype
    const newFile = new File(filename, sourceDir)
    const payload = filetypes[type]

    // If there is a custom `file.js` type to override something from `File` ...
    // ... class, then inject it before injecting anything else. This is ...
    // ... like "common" properties and methods for all custom file types ...
    // ... to avoid duplicating code per each custom file type
    if (filetypes.file)  Object.keys(filetypes.file).forEach(key => {
        newFile[key] = filetypes.file[key]
      })

    // Inject custom filetype properties and methods
    Object.keys(payload).forEach(key => {
      if (key === 'file') return // skip it, has already been injected above
      newFile[key] = payload[key]
    })

    // squeeze it but not contextualize it yet, means, build the "recipe" ...
    // ... and get first content but do not run the "recipe" yet
    newFile.initialize(plugin, pluginConfig)

    return newFile
  }

}
