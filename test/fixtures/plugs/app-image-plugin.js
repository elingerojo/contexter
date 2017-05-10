'use strict'

const fs              = require('fs-extra')
const path            = require('upath')

module.exports = {
  // Optional plugin `check()` precedence: higher first to lower last
  priority: 10,

  // Mandatory. File type that the plugin serves
  filetype: 'image',

  // Used to add watch file 'globs' patterns for watch optimization
  watchExtensions: ['.jpeg', '.jpg', '.svg', '.png', '.gif'],

  // calls back with result indicating whether plugin should process file.
  check (filename, callback) {
    const extension = path.extname(filename).toLowerCase()
    const allowedExtensions = this.watchExtensions
    var isSvgFont = false
    if (extension === '.svg') {
      isSvgFont = fs.readFileSync(filename, 'utf8').indexOf('</font>') > -1
    }
    return callback(null, allowedExtensions.indexOf(extension) > -1 && !isSvgFont)
  },

  parse (file, callback) {
    file.setDimensions()
    return callback(null)
  }

}
