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

    it('has an object for a root property where dir structure will be mirrored ( like `context["/"]` )', function(){
      expect(context["/"]).to.be.an('object')
      expect(context.unknowns).to.be.an('array')
    })

    it('has an array for datafiles and unknowns', function(){
      expect(context.datafiles).to.be.an('array')
      expect(context.unknowns).to.be.an('array')
    })
  })

  describe('context root property ( `context["/"]` )', function() {

    it('has subdirs that can be accessed by dot notation ( like `context["/"].assets` )', function () {
      expect(context["/"].assets).to.exist
      expect(context["/"].assets).to.be.an('object')
    })

    it('does NOT have a subdir named `node_modules` because was ignored by default', function () {
      expect(context["/"]["node_modules"]).to.not.exist
    })

    it('has files that can be accessed by named key notation', function(){
      expect(context["/"].assets["posts.yml"]).to.be.an('object')
      expect(context["/"].assets["posts.yml"].path.relative).to.equal('/assets/posts.yml')
    })

    it('has data extracted from a datafile nested in a subdir', function(){
      expect(context["/"].assets["posts.yml"]).to.exist
      expect(context["/"].assets["posts.yml"].data).to.exist
      expect(context["/"].assets["posts.yml"].data.foo).to.exist
      expect(context["/"].assets["posts.yml"].data.foo).to.equal('bar')
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

  it("emits a 'ready' event with a context object that has a root property ( `context["/"]` ) ", function (done) {

    ctxr.watcher(sourceDir)
      .on('ready', (_context) => {
        context = _context
        expect(context).to.be.an('object')
        expect(context["/"]).to.be.an('object')
        done()
      })
  })

  describe('context root property ( `context["/"]` )', function() {

    it('has subdirs that can be accessed by dot notation ( like `context["/"].assets` )', function () {
      expect(context["/"].assets).to.exist
      expect(context["/"].assets).to.be.an('object')
    })

    it('has files that can be accessed by named key notation ( like `context["/"]["index.html"]` )', function(){
      expect(context["/"]["index.html"]).to.be.an('object')
      expect(context["/"]["index.html"].path.relative).to.equal('/index.html')
    })

    it('has data extracted from a datafile nested in a subdir', function(){
      expect(context["/"].assets["posts.yml"]).to.exist
      expect(context["/"].assets["posts.yml"].data).to.exist
      expect(context["/"].assets["posts.yml"].data.foo).to.exist
      expect(context["/"].assets["posts.yml"].data.foo).to.equal('bar')
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

// ...one more different config
describe('Contexter with config = {pluginConfig: {"root": <dir-name>} }', function () {
  var ctxr
  var context

  this.timeout(10000)

  before(function(){
    ctxr = new Contexter({
      pluginConfig: {'root': sourceDir.substring(sourceDir.lastIndexOf('/'))}
    })
  })

  it("emits a 'ready' event with a context object that has a root property named after <source-dir> ", function (done) {

    ctxr.watcher(sourceDir)
      .on('ready', (_context) => {
        context = _context
        expect(context).to.be.an('object')
        expect(context["/fixtures"]).to.be.an('object')
        done()
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
        expect(context["/"]).to.be.an('object')
        expect(context["/"].assets).to.not.exist
        done()
      })
  })

})
