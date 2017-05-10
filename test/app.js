/* globals describe, it */

const exists    = require('path-exists').sync
const expect    = require('chai').expect
const path      = require('upath')
const tmp       = require('tmp')
const uniq      = require('lodash').uniq
const Contexter = require('../lib/index')

const they      = it
const test      = it

const sourceDir = path.join(__dirname, 'fixtures')
const targetDir = path.normalize(tmp.dirSync().name)

describe('Contexter without config', function () {
  var ctxr
  var context

  this.timeout(10000)

  before(function(){
    ctxr = new Contexter()
  })

  it('is a function (classes are functions)', function () {
    expect(Contexter).to.be.a('function')
  })

  it('is an object when instantiated', function () {
    expect(ctxr).to.be.a('object')
  })

  it("emits a series of lifecycle events, ultimately emitting a context object", function (done) {
    var events = []

    ctxr.watcher(sourceDir)
      .on('started', () => events.push('started'))
      .on('contexting', () => events.push('contexting'))
      .on('adding', () => events.push('adding'))
      .on('all', () => events.push('all'))
      .on('ready', (_context) => {
        expect(uniq(events)).to.deep.equal(['started', 'all', 'adding', 'contexting'])
        context = _context
        done()
      })
  })

  describe('context', function() {

    it('is an object returned by the `ready` event', function () {
      expect(context).to.exist
      expect(context).to.be.an('object')
    })

    it('has an object for a root property where dir structure will be mirrored ( like `context.fixtures` )', function(){
      expect(context.fixtures).to.be.an('object')
    })

    it('has an array for datafiles and unknowns', function(){
      expect(context.datafiles).to.be.an('array')
      expect(context.unknowns).to.be.an('array')
    })
  })

  describe('context root property ( `context.fixtures` )', function() {

    it('has subdirs that can be accessed by dot notation ( like `context.fixtures.assets` )', function () {
      expect(context.fixtures.assets).to.exist
      expect(context.fixtures.assets).to.be.an('object')
    })

    it('does NOT have a subdir named `node_modules` because was ignored by default', function () {
      var dummyModule = __dirname + '/fixtures/node_modules/dummy-module.js'
      expect(exists(dummyModule)).to.be.true
      expect(context.fixtures["node_modules"]).to.not.exist
    })

    it('has files that can be accessed by named key notation', function(){
      expect(context.fixtures.assets["posts.yml"]).to.be.an('object')
      expect(context.fixtures.assets["posts.yml"].path.relative).to.equal('/assets/posts.yml')
    })

    it('has data extracted from a datafile nested in a subdir', function(){
      expect(context.fixtures.assets["posts.yml"]).to.exist
      expect(context.fixtures.assets["posts.yml"].data).to.exist
      expect(context.fixtures.assets["posts.yml"].data.foo).to.exist
      expect(context.fixtures.assets["posts.yml"].data.foo).to.equal('bar')
    })
  })

  describe('datafiles array have file elements that', function(){

    they('can be accessed by a named key like `context.datafiles["/assets/posts.yml"]`', function(){
      var datafile = __dirname + '/fixtures/assets/posts.yml'
      expect(exists(datafile)).to.be.true

      expect(context.datafiles).to.be.an('array')
      expect(context.datafiles["/assets/posts.yml"]).to.be.an('object')
    })

    they('have extracted data that can be accessed like `context.datafiles["/assets/posts.yml"].data`', function(){

      expect(context.datafiles["/assets/posts.yml"].data).to.be.an('object')
      expect(context.datafiles["/assets/posts.yml"].data.foo).to.equal('bar')
    })

  })

  describe('unknowns array', function () {
    var unknowns
    var filenames

    before(function(){
      unknowns = context.unknowns
      filenames = unknowns.map(f => f.path.relative)
    })

    they('does NOT include extensionless files like CNAME', function(){
      expect(filenames).to.not.contain('/CNAME')
    })

    they('does NOT include files with extensions like `.md`, `.html`, `.jpg`, ...', function(){
      expect(filenames).to.not.contain('/README.md')
      expect(filenames).to.not.contain('/index.html')
      expect(filenames).to.not.contain('/assets/photo.jpg')
    })
  })

})

// Test with different configs
describe('Contexter with config = {isWatchAll: true}', function () {
  var ctxr
  var context

  this.timeout(10000)

  before(function(){
    ctxr = new Contexter({
      isWatchAll: true
    })
  })

  it('emits a "ready" event with a context object that has a root property ( `context.fixtures` ) ', function (done) {

    ctxr.watcher(sourceDir)
      .on('ready', (_context) => {
        context = _context
        expect(context).to.be.an('object')
        expect(context.fixtures).to.be.an('object')
        done()
      })
  })

  describe('context root property ( `context.fixtures` )', function() {

    it('has subdirs that can be accessed by dot notation ( like `context.fixtures.assets` )', function () {
      expect(context.fixtures.assets).to.exist
      expect(context.fixtures.assets).to.be.an('object')
    })

    it('has files that can be accessed by named key notation ( like `context.fixtures["index.html"]` )', function(){
      expect(context.fixtures["index.html"]).to.be.an('object')
      expect(context.fixtures["index.html"].path.relative).to.equal('/index.html')
    })

    it('has data extracted from a datafile nested in a subdir', function(){
      expect(context.fixtures.assets["posts.yml"]).to.exist
      expect(context.fixtures.assets["posts.yml"].data).to.exist
      expect(context.fixtures.assets["posts.yml"].data.foo).to.exist
      expect(context.fixtures.assets["posts.yml"].data.foo).to.equal('bar')
    })
  })

  describe('unknowns array', function () {
    var unknowns
    var filenames

    before(function(){
      unknowns = context.unknowns
      filenames = unknowns.map(f => f.path.relative)
    })

    they('includes extensionless files like CNAME', function(){
      expect(filenames).to.contain('/CNAME')
    })

    they('includes files with extensions like `.md`, `.html`, `.jpg`, ...', function(){
      expect(filenames).to.contain('/README.md')
      expect(filenames).to.contain('/index.html')
      expect(filenames).to.contain('/assets/photo.jpg')
    })
  })

})

// Test with custom plugin for custom file type `image`
describe('Contexter accepts custom plugin for custom file type like `image`', function () {
  var ctxr
  var context

  this.timeout(10000)

  before(function(){
    ctxr = new Contexter()

    // extend to custom file type `image`
    var customType = require(sourceDir + '/types/image.js')
    ctxr.extend('image', customType)

    // use custom plugin `app-image-plugin`
    var customPlugin = require(sourceDir + '/plugs/app-image-plugin.js')
    ctxr.use(customPlugin)

  })

  it("emits a 'ready' event with a context object that has a root property named after `images`", function (done) {

    ctxr.watcher(sourceDir)
      .on('ready', (_context) => {
        context = _context
        expect(context).to.be.an('object')
        expect(context.images).to.exist
        done()
      })
  })

  describe('images is an array that has a file element that', function(){

    they('can be accessed by a named key like `context.images["/assets/photo.jpg"]`', function(){
      var image = __dirname + '/fixtures/assets/photo.jpg'
      expect(exists(image)).to.be.true

      expect(context.images).to.be.an('array')
      expect(context.images["/assets/photo.jpg"]).to.be.an('object')
    })

    they('have extracted data that can be accessed like `context.images["/assets/photo.jpg"].dimensions`', function(){

      expect(context.images["/assets/photo.jpg"].dimensions).to.be.an('object')
      expect(context.images["/assets/photo.jpg"].dimensions.width).to.equal(1600)
    })

  })

  describe('custom plugin for images can not process fonts so', function(){
    var unknowns
    var filenames

    before(function(){
      unknowns = context.unknowns
      filenames = unknowns.map(f => f.path.relative)
    })

    it('a font file with image-like extension is in `unknowns` array', function(){
      expect(filenames).to.contain('/assets/glyphicons-halflings-regular.svg')
    })

  })

})

// ... test passing `ingores` directly to `chokidar` (using `isWatchAll: true`)
describe('Contexter.watcher with ignores', function () {
  var ctxr
  var context
  var options

  this.timeout(10000)

  before(function(){
    ctxr = new Contexter({
      isWatchAll: true
    })
    options = {ignored: [].concat(path.join(sourceDir, './assets'))}
  })

  it("emits a 'ready' event with a context object that does not have an ignored subdirectory ", function (done) {

    ctxr.watcher(sourceDir, options)
      .on('ready', (_context) => {
        context = _context
        expect(context).to.be.an('object')
        expect(context.fixtures).to.be.an('object')
        expect(context.fixtures.assets).to.not.exist
        expect(context.fixtures['node_modules']).to.exist
        done()
      })
  })

})
