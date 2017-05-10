'use strict'

module.exports =  {
  // Overrides `File` class default `parseCallback` method to assign `this.data`
  parseCallback (err, output) {
    if (err) throw err

    // Assign `output` to `file.data` (instead of default `file.output`)
    this.data = output
  }

}
