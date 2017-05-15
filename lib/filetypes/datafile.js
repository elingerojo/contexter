'use strict'

module.exports =  {
  // Overrides `File` class default `parseCallback` method to assign `this.data`
  parseCallback (err, output) {

    // No error handling here. Better to be handled by the calling ...
    // ... application with a similar `parseCallback()` override that ...
    // ... replaces this `if (err) throw err` line of code with a complete ...
    // ... error handling to suit each filetype
    // (see sample code in same `parseCallback()` method at `lib/file.js`)
    if (err) throw err

    // Assign `output` to `file.data` (instead of default `file.output`)
    this.data = output
  }

}
