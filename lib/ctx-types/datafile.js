'use strict'

const path            = require('upath')

module.exports =  {
  read () {
    // No-op. `Datafile` class should not read files at all. The read ...
    // ... operation is done inside plugin whether is standad or not
    // This function placeholder needs to be here to override `File` class read ()
  },

  // Overrides `File` class default `parseCallback` method to assign `this.data`
  parseCallback (err, output) {
    if (err) throw err

    this.data = output
  }

}
