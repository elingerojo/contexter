'use strict'

module.exports =  {
  // Overrides `File` class default `read()` method
  read () {
    // No-op. `datafile` file type should not read files at all. The read ...
    // ... operation is done inside plugin more efficintly by external lib
    // This function placeholder needs to be here to override `File` class read ()
  },

  // Overrides `File` class default `parseCallback` method to assign `this.data`
  parseCallback (err, output) {
    if (err) throw err

    // Assign `output` to `file.data` (instead of default `file.output`)
    this.data = output
  }

}
