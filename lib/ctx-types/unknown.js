'use strict'

module.exports = {
  // Overrides `File` class default `read()` method
  read () {
    // No-op. `unknown` file type does not read files at all.
    // This function placeholder needs to be here to override `File` class read ()
  }

}
