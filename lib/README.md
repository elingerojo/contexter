### Default structure (of `context` object)

The `context` object has the following default structure:

- &lt;root&gt;
- &lt;filetypes-1&gt;
- &lt;filetypes-2&gt;
- ...
- &lt;filetypes-n&gt;
- unknowns

&lt;root&gt; name is configurable so it can be any word or phrase in a string (in the example is the directory name "dir")

Equivalent example:

```js
var context = {
  dir: {...}, // contain subdirs and files
  datafiles: [...],
  images: [...],
  stylesheets: [...],
  unknowns: [...]
}
```

Note: The first property `dir` is an object and all others are arrays

##### &lt;root&gt; key

&lt;root&gt; has an object value that contains more objects reflecting the directory tree structure

These "branch" structures have other "branches" that have terminal "leafs" (properties named after the filenames including the extension). For example, file `photo.jpg` inside a subdirectory named `assets` will be referenced as `...assets['photo.jpg'] = <file>` where `file` is an object as defined by the corresponding `plugin`

So, in other words, the &lt;root&gt; has three parts:

1. The directory tree structure "branches"
2. `filenames` property "leafs"
3. `file` objects values of the "leafs" that are another tree-like structures by they own (as defined by corresponding `plugin`)

For example:
```js
// Part 1. `.dir.assets`
// Part 2. `['photo.jpg']`
// Part 3. `.data.dimensions.width`

console.log( context.dir.assets['photo.jpg'].data.dimensions.width )
> 220 // pixels
```

Note: `assets` it is not an array. It is an object with "filename named" keys

##### &lt;filetypes-1&gt;, &lt;filetypes-2&gt;,... unknowns keys

Each &lt;filetypes&gt; key has an array of `file`s objects defined by the corresponding `plugin`

So each `file` appears **twice** in the `context` object. One as the "leaf" value at some sublevel of the &lt;root&gt; and the second time as a member of one of the filetype arrays (the one that corresponds to its type or `unknowns` in case it was not able to be processed for any reason)

The number of &lt;filetypes&gt; keys (arrays) correspond to the number of `filetype`s available on the application. `npm contexter` only start with two: `datafiles` and `unknowns` but can easily be extended to many more file types to suit

### "contextualizing" overview

> At the end, file data (and metadata) is represented in a `file` object at some deep level inside `context` object

`npm contexter` provides a framework to build configurable `file`s objects that represent the data (and metadata) that we want to extract from the directory files **and it's relation to other files**

> The process of representing this relations is called "contextualizing" because it builds the "context" that the `file` is immersed in.

An example step of "contextualizing" a file could be creating a property named `localImages` inside a HTML `file`. The property could contain an array with all the `image`s that are in the same directory as the HTML file

This array sets a relation between `file`s (images and the HTML file).

With this array, it will be easy to "pull out" and use all "local images" metadata like this:

```js
var actualHeightRequired = 0 // Initialize accumulator to zero pixels

context.dir.subdir['index.html'].localImages.forEach( function (img) {
  // Add the height metadata of each image
  actualHeightRequired = actualHeightRequired + img.data.dimension.height
})
```

This example shows the **usage** easiness, not the actual "contextualizing recipe" required to populate the `localImages` array

> "contextualizing recipe" are the steps performed to build the `file` object with the content and format defined by the application author

The "contextualizing recipe" is built with a **configurable** `file`

### Configurable `file` overview

Configurable `file` means that you 'pick and choose' what goes or not inside. This concept is an opinionated manifestation of a general `virtual file` concept where the `file` JavaScript object is the representation of a physical directory file. Opinionated because, as a framework, it has core methods already chosen and a particular sequence mechanism to easy the configuration burden

> Each `plugin` is a `file` factory of a particular `filetype`

Each time `npm contexter` finds a new physical directory file, it search for a corresponding `plugin` to create a `file` with the data (and metadata)

### `npm contexter` internal workflow

> Produces a `context` javascript object with the data (and metadata) of files in a directory

Basically, `npm contexter` does:

1. INPUT files
2. OUTPUT data

Lets start by the end, at the **OUTPUT data**

- **Where** to put it?
We know it will be in a javascript **object** so it will be in a tree-like structure, but...
    - At what level?
    - Under what property name?
- **What** to put and what not?
- **How** to put it?
    - Should it be an array?
    - Should it be a property or another sub object?
    - **What** format?

Questions and more questions that will lead to a lot of decisions. All of them should be unequivocally answered by a collection of methods arranged in a particular sequence to do the job

> Important! A good example of a `context` object consumers are template engines like `handlebars`. They receive a JavaScript object with all the data needed to render an output. So all the efforts to construct the `context` object, should be to ease the data consumption by libraries alike

Now, lets take a look at the **INPUT file**

- Where are they?
- How to read them?
- etc...

Again, we have questions that lead to decisions that should be unequivocally answered _by a sequence of methods_

> `npm contexter` has sequenced collections of methods to transform INPUT files in OUTPUT data.

An application that uses `npm contexter`, assembles a customized collection for each file type it wants to process.

The sequence is always the same, 1-2-3:

1. **Ingredients** - Collect all methods to be used

    - Creates an instance of `file` to have a place to hold all custom methods, data and metadata

    - Inject the `filetype` and `plugin` custom methods

      > _Inject_ is used to emphasis overriding. The `file` already has default methods but they are "overridden" by custom ones depending on the file type and plugin used

2. **Recipe** - Assembles a "contextualizing recipe"

    - First, **core file steps** - Methods that all files should perform independently of the application. Steps like reflecting the directory structure in the `context` JavaScript object. This should be done for all files, no matter the type so that they are called "core"

    - Second, **file type steps** - Methods that are particular to the file type being processed. Steps like assigning the `file` to a corresponding `filetype` array for easy grouping or any other methods that may be different cause of the type of file.

    - Finally, **plugin steps** - Methods that are particular to the plugin being processed.

    > At this point, the `file`'s contextualize recipe is ready to be used

3. **Cook** - Process the physical directory file

    - Extract info about the physical directory file
        - `setStats()` - Obtain the file system stats for the file

        - `getContent()` - Get the file content and parse it

    - Run the `file`'s "contextualize recipe"

This is where the `context` object finally gets its particular content and format defined by the application's author

### Customization levels

As you may have noticed from the sequence above, there are three customization levels

1. core `file`
2. file type
3. plugin

##### 1. core `file` level customization

This level are the methods common to ALL files. This level is seldom customized because is already bare bones basic

Methods:
- `setPath()` - Establish useful path values for file handling
- `initialize()` - Set up the corresponding `plugin`
- `addRecipeSteps()` - Loads the "contextualize recipe" from the `filetype` and `plugin` methods
- `squeeze()` - Extracts file data (and metadata)

##### 2. file type level customization

This level are the methods common to each particular file type. Each file type has its own. This level is the "glue" between the next level where most customization is done and the previous where seldom customization happens

Ex. `datafile` type customization

1. Override the generic `read()` method with `no-operation` meaning, no generic reading file when `getContent()` is executed because the file is better going to be read by the `plugin` method `parse()` using efficient libraries to do so, libraries that do not keep all the file in memory and have been "battle tested" for efficiency

2. Override `parseCallBack()` - function used simply to state where the `parse()` output will be stored. In this case, in `file.data` (instead of default `file.input`)

Ex. `image` type customization

_(This type is not present by default in `npm contexter`. Shown here for didactic purposes only)_

1. Override the generic `read()` method with `no-operation` - same reason as above `datafile` example

2. `parseCallBack()` - `no-operation` same as above. Continue below

3. `setDimensions()` - use `npm image-size` to obtain width and height and have it handy

Other possible file types

- `stylesheet`
- `layout`
- `script`
- ..., etc.

Each one should have methods to deal with the particular file type they represent

##### 3. plugin level customization

Each `plugin` has its unique implementation but all happens inside a fixed common set of hi-level-process methods

The properties and hi-level-process methods in the fixed set are:
- `check()`
- `parse()`
- `render()`
- `watchExtensions` - Array of possible file extensions
- `filetype` - String with the file type the plugin serves
- `priority` - Integer that defines `check()` precedence between plugins

Ex. `JSON-YAML-datafile-plugin` customization

1. `filetype` - 'datafile'

2. `watchExtensions` - `['.json', '.yml', '.yaml']` (used for watch optimization)

3. `check()` - calls back with a result indicating whether this plugin should process the given filename (commonly uses `watchExtensions` as part of the selection logic)

4. `parse()` - detects the file type and extract either JSON or YML data

Note: Did not use `render()`

Ex. `compilers-stylesheet-plugin` customization

_(This plugin is not present by default in `npm contexter`. Shown here for didactic purposes)_

1. `filetype` - 'stylesheet'

2. `watchExtensions` - ['.css', '.less', '.sass', '.scss', '.styl']  (used for watch optimization)

3. `check()` - calls back with a result indicating whether this plugin should process the given filename (commonly uses `watchExtensions` as part of the selection logic)

4. `render()` - Detects file extension and calls corresponding library to render like `npm less`, `npm stylus` or `npm node-sass`, etc...

Note: Did not use `parse()`

Other possible plugins

- `CSSnext-stylesheet-plugin`
- `HBS-partial-plugin`
- `MARKY-markdown-plugin`
- `CSV-datafile-plugin`
- ..., etc.

Each `plugin` have a mandatory `check()` and optionally `parse()` and/or `render()` methods to process the corresponding `file`

Side note: The plugin name could be any string but it is helpful to be descriptive
