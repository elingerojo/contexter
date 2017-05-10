'use strict'

module.exports = {
  // Optional plugin `check()` precedence: higher first to lower last
  priority: 0,

  // Mandatory. File type that the plugin serves
  filetype: 'unknown',

  // calls back with result indicating whether plugin should process file.
  check (filename, callback) {
    return callback(null, true) // catch all
  }

}
