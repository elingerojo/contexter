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
var ctxr
var context

describe('Contexter', function () {
  this.timeout(10000)

  before(function(){
    const files = {}
    const plugins = {}

    const configs = {
      pluginConfig: {'targetDir': targetDir}
    }
    ctxr = new Contexter(configs)

    // ".extend()" the basic Contexter file type(s) with app's file types
    Object.keys(files).forEach(type => {
      // `.extend(name-of-type, file-type-object)`
      ctxr.extend(type, files[type])
    })

    // Set ".use()" plugins in `priority` order
    Object.keys(plugins).sort((a, b) => {
      return plugins[a].priority || 0 - plugins[b].priority || 0
    }).forEach(plugin => ctxr.use(plugins[plugin]))

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

    they('includes extensionless files like CNAME', function(){
      expect(filenames).to.contain('/CNAME')
    })

    they('includes all non datafiles like `.md`, `.html`, `.jpg`, ...', function(){
      expect(filenames).to.contain('/README.md')
      expect(filenames).to.contain('/index.html')
      expect(filenames).to.contain('/assets/photo.jpg')
    })
  })

/*

  describe('files', function() {
    var files

    before(function(){
      files = context.files
    })

    they('are in an array', function () {
      expect(files).to.be.an('array')
    })

    they('are sometimes ignored', function(){
      var file = __dirname + '/fixtures/redirects.json'
      expect(exists(file)).to.be.true

      var filenames = files.map(f => f.path.relative)
      expect(filenames).to.contain('/index.md')
      expect(filenames).to.not.contain('/redirects.json')
    })

    describe('path', function() {
      it('is an object with a bunch of sliced and diced info about the filename', function(){
        expect(files['/apples.md'].path.full).to.include('/test/fixtures/apples.md')
        expect(files['/apples.md'].path.relative).to.equal('/apples.md')
        expect(files['/apples.md'].path.processRelative).to.equal('test/fixtures/apples.md')
        expect(files['/apples.md'].path.root).to.equal('/')
        expect(files['/apples.md'].path.dir).to.equal('/')
        expect(files['/apples.md'].path.base).to.equal('apples.md')
        expect(files['/apples.md'].path.ext).to.equal('.md')
        expect(files['/apples.md'].path.name).to.equal('apples')

        expect(files['/apples.md'].path.target.relative).to.equal('/apples.html')
        expect(files['/apples.md'].path.target.full).to.equal(`${targetDir}/apples.html`)
        expect(files['/apples.md'].path.target.ext).to.equal(`.html`)
      })

      it('includes target.relative', function () {
        expect(files['/apples.md'].path.target.relative).to.equal('/apples.html')
        expect(files['/styles.scss'].path.target.relative).to.equal('/styles.css')
        expect(files['/babel-and-browserify.js'].path.target.relative).to.equal('/babel-and-browserify.js')
      })

      it('includes target.full', function () {
        expect(files['/apples.md'].path.target.full).to.equal(`${targetDir}/apples.html`)
        expect(files['/styles.scss'].path.target.full).to.equal(`${targetDir}/styles.css`)
        expect(files['/babel-and-browserify.js'].path.target.full).to.equal(`${targetDir}/babel-and-browserify.js`)
      })

      it('includes target.ext', function () {
        expect(files['/apples.md'].path.target.ext).to.equal('.html')
        expect(files['/styles.scss'].path.target.ext).to.equal('.css')
        expect(files['/babel-and-browserify.js'].path.target.ext).to.equal('.js')
      })
    })
  })

  describe('unknowns', function () {
    var unknowns
    var filenames

    before(function(){
      unknowns = context.unknowns
      filenames = unknowns.map(f => f.path.relative)
    })

    they('include extensionless files like CNAME', function(){
      expect(filenames).to.contain('/CNAME')
    })

    they('include zip files', function(){
      expect(filenames).to.contain('/archive.zip')
    })
  })

  describe('pages', function () {
    var pages

    before(function(){
      pages = context.pages
    })

    they('have a "clean URL" href', function () {
      expect(pages['/apples.md'].href).to.equal('/apples')
    })

    they('have a "clean URL" href', function () {
      expect(pages['/thumbs/index.html'].href).to.equal('/thumbs')
    })

    they('include .md files', function () {
      expect(pages['/apples.md']).to.exist
    })

    they('include .markdown files', function () {
      expect(pages['/other/papayas.markdown']).to.exist
    })

    they('include .html files', function () {
      expect(pages['/oranges.html']).to.exist
    })

    they('are loaded regardless of case', function () {
      expect(pages['/other/UPPERCASE.HTML']).to.exist
    })

    they('ingest HTML frontmatter', function () {
      expect(pages['/apples.md'].title).to.equal('Apples!')
      expect(pages['/apples.md'].keywords).to.deep.equal(['fruit', 'doctors'])
    })

    they('preserve original content in `input`', function () {
      expect(pages['/other/papayas.markdown'].input).to.be.a('string')
    })

    they('convert markdown to HTML', function () {
      var $ = pages['/other/papayas.markdown'].$
      expect($('a[href="https://digestion.com"]').text()).to.equal('digestion')
    })

    they('have a cheerio DOM object ($)', function () {
      var $ = pages['/other/papayas.markdown'].$
      expect($).to.exist
      expect($.text).to.be.a('function')
      expect($.html).to.be.a('function')
    })

    they('get a titlecased version of their filename as a default title, if not set', function (done) {
      var page = pages['/other/papayas.markdown']
      expect(page.title).to.equal('Papayas')

      // <title> tag is set after render
      page.render(context, function(err, output){
        var $ = cheerio.load(output)
        expect($('title').text()).to.equal('Papayas')
        done()
      })
    })

    describe('lobars handlebars helpers', function() {

      test('eq', function (done) {
        var page = pages['/other/papayas.markdown']

        expect(page.flavor).to.equal('delicious')
        expect(page.input).to.include('They are delicious')
        expect(page.input).to.include('They are NOT delicious')

        page.render(context, function(err, output){
          expect(output).to.include('They are delicious')
          expect(output).to.not.include('They are NOT delicious')
          done()
        })
      })

      test('lowerCase', function (done) {
        var page = pages['/other/papayas.markdown']

        expect(page.input).to.include('--Foo-Bar')
        expect(page.input).to.not.include('foo bar')

        page.render(context, function(err, output){
          expect(output).to.not.include('--Foo-Bar')
          expect(output).to.include('foo bar')
          done()
        })
      })

      test('endsWith', function (done) {
        var page = pages['/other/papayas.markdown']

        expect(page.input).to.include('abc does end with c')

        page.render(context, function(err, output){
          expect(output).to.include('abc does end with c')
          done()
        })
      })

    })

    describe('`src` attributes in the DOM', function() {
      var $input
      var $output

      before(function(done) {
        var page = pages['/other/index.md']
        $input = cheerio.load(page.input)
        page.render(context, function(err, output){
          $output = cheerio.load(output)
          done()
        })
      })

      it('converts relative', function(){
        expect($input('#guava-relative-link').attr('src')).to.equal('other/guava.png')
        expect($output('#guava-relative-link').attr('src')).to.equal('other/guava.png')

        expect($input('#banana-script').attr('src')).to.equal('other/banana.js')
        expect($output('#banana-script').attr('src')).to.equal('other/banana.js')
      })

      // it('ignores relative with leading slash', function(){
      //   expect(input).to.include('<img src="/guava-leading-slashy.png">')
      //   expect(output).to.include('<img src="/guava-leading-slashy.png">')
      // })
      //
      // it('ignores absolute', function(){
      //   expect(input).to.include('<img src="https://guava.com/logo.png">')
      //   expect(output).to.include('<img src="https://guava.com/logo.png">')
      // })
      //
      // it('ignores protocol-relative', function(){
      //   expect(input).to.include('<img src="//guava-relative.com/logo.png">')
      //   expect(output).to.include('<img src="//guava-relative.com/logo.png">')
      // })

    })

    describe('`href` attributes in the DOM', function() {
      var input
      var output

      before(function() {
        input = pages['/other/index.md'].input
        output = pages['/other/index.md'].$.html()
      })

      it('converts relative', function(){
        expect(input).to.include('<a href="other/papayas">papayas</a>')
        expect(output).to.include('<a href="other/papayas">papayas</a>')
      })

      it('ignores relative with leading slash', function(){
        expect(input).to.include('<a href="/grapes">grapes</a>')
        expect(output).to.include('<a href="/grapes">grapes</a>')
      })

      it('ignores absolute', function(){
        expect(input).to.include('<a href="http://mango.com">mango.com</a>')
        expect(output).to.include('<a href="http://mango.com">mango.com</a>')
      })

      it('ignores protocol-relative', function(){
        expect(input).to.include('<a href="//coconut-cdn.com">coconut-cdn.com</a>')
        expect(output).to.include('<a href="//coconut-cdn.com">coconut-cdn.com</a>')
      })
    })

    describe('title', function(){
      it('is derived from HTML frontmatter', function () {
        expect(pages['/apples.md'].title).to.equal('Apples!')
      })

      it('falls back to <title> tag, if present', function () {
        expect(pages['/oranges.html'].title).to.equal('We are Oranges')
      })

      it('falls back lastly to titlecased basename', function () {
        expect(pages['/other/papayas.markdown'].title).to.equal('Papayas')
      })

      it('injects <title> tag into HTML, if absent', function (done) {
        pages['/oranges.html'].render(context, function(err, output){
          expect(output).to.include('<title>We are Oranges</title>')
          done()
        })
      })
    })
  })

  describe('images', function(){
    var pages

    before(function(){
      pages = context.pages
    })

    it("are attached to pages in the same directory", function () {
      expect(pages['/thumbs/png/index.md'].images.thumb).to.exist
    })

    they('can be SVGs', function () {
      expect(pages['/thumbs/svg/index.md'].images.thumbnail).to.exist
    })

    they('can be JPGs', function () {
      expect(pages['/thumbs/jpg/index.html'].images.thumb).to.exist
    })

    they('can be GIFs', function () {
      expect(pages['/thumbs/gif/index.md'].images.thumb).to.exist
    })

    they('include width and height dimensions', function() {
      const jpg = pages['/thumbs/jpg/index.html'].images.thumb
      expect(jpg.dimensions.width).to.equal(170)
      expect(jpg.dimensions.height).to.equal(170)
    })

    they('include exif data', function(){
      const jpg = pages['/thumbs/jpg/index.html'].images.thumb
      expect(jpg.exif.imageSize.width).to.equal(170)
      expect(jpg.exif.imageSize.height).to.equal(170)
    })

    they('include color data as hex strings', function(){
      var colors = pages['/thumbs/gif/index.md'].images.thumb.colors
      expect(colors).to.be.an('array')
      expect(colors[0]).to.match(/^#[0-9a-f]{3,6}$/i)
    })
  })

  describe('datafiles', function(){
    var page
    var output
    var data

    they("get a special non-filenamey key that can accessed within a handlebars template", function(){
      var file = __dirname + '/fixtures/other/nested/delicious_data.json'
      expect(exists(file)).to.be.true

      expect(context.datafiles).to.be.an('array')
      expect(context.datafiles.other_nested_delicious_data.data).to.be.an('object')
      expect(context.datafiles.other_nested_delicious_data.data.delicious).to.equal(true)
      expect(context.datafiles.other_nested_delicious_data.data.deliciousness).to.equal(9)
    })

    before(function(done){
      page = context.pages['/thumbs/index.html']
      data = page.data
      page.render(context, function(err, _output){
        output = _output
        done()
      })
    })

    it("attaches data from JSON files to files in the same directory", function () {
      expect(data.some_json_data.name).to.equal('cookie monster')
      expect(data.some_json_data.food).to.equal('cookies')
    })

    it("attaches data from YML files too", function () {
      expect(data.some_yml_data.name).to.equal('Bert')
      expect(data.some_yml_data.friend).to.equal('Ernie')
    })

    it('injects data into templates', function(){
      expect(output).to.contain('His name is cookie monster')
      expect(output).to.contain('Another character is Bert')
    })

    it('includes the `pages` object in the context', function(){
      expect(output).to.contain('<li class="page">/other</li>')
      expect(output).to.contain('<li class="page">/other/papayas</li>')
    })
  })
*/
})
