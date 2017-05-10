'use strict'

const fs              = require('fs-extra')
const path            = require('upath')
const yaml            = require('js-yaml')

module.exports = {
  // Optional plugin `check()` precedence: higher first to lower last
  priority: 10,

  // Mandatory. File type that the plugin serves
  filetype: 'datafile',

  // Used to add watch file 'globs' patterns for watch optimization
  watchExtensions: ['.json', '.yml', '.yaml'],

  // calls back with result indicating whether plugin should process file.
  check (filename, callback) {
    const extension = path.extname(filename).toLowerCase()
    const allowedExtensions = this.watchExtensions

    return callback(null, allowedExtensions.indexOf(extension) > -1)
  },

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
}
