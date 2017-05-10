'use strict'

const fs              = require('fs-extra')
const path            = require('upath')
const imageSize       = require('image-size')

module.exports = {
  // Overrides `File` class default `parseCallback` method. No output needed
  parseCallback (err) {
    if (err) throw err
  },

  setDimensions () {
    try {
      this.dimensions = imageSize(this.path.processRelative)
    } catch (e) {
      this.dimensions = null
    }
  }

}
