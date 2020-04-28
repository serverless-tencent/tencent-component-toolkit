const path = require('path')
const fs = require('fs')
const utils = require('./utils')
const INSTRUMENTATIONS = require('./instrumentations')()

function _firstPartyInstrumentation(agent, fileName, nodule) {
  if (!fs.existsSync(fileName)) {
    return
  }
  try {
    return require(fileName)(agent, nodule)
  } catch (error) {
    agent.emit('responseFinish')
  }
}

const shimmer = (module.exports = {
  /**
   * Patch the module.load function so that we see modules loading and
   * have an opportunity to patch them with instrumentation.
   */
  patchModule: function patchModule(agent) {
    const Module = require('module')
    const filepathMap = {}

    /**
     * Forces file name resolve for modules not in our cache when
     * their parent has already been loaded/cached by Node.
     * Provides a fall-back for unexpected cases that may occur.
     * Also provides flexibilty for testing now that node 11+ caches these.
     * @param {*} request
     * @param {*} parent
     * @param {*} isMain
     */
    function resolveFileName(request, parent, isMain) {
      const cachedPath = filepathMap[request]
      if (!cachedPath && parent && parent.loaded) {
        // Our patched _resolveFilename will cache. No need to here.
        return Module._resolveFilename(request, parent, isMain)
      }

      return cachedPath
    }

    utils.wrapMethod(Module, '_resolveFilename', function wrapRes(resolve) {
      return function wrappedResolveFilename(file) {
        // This is triggered by the load call, so record the path that has been seen so
        // we can examine it after the load call has returned.
        const resolvedFilepath = resolve.apply(this, arguments)
        filepathMap[file] = resolvedFilepath
        return resolvedFilepath
      }
    })

    // Node在模块加载时都会调用到Module的_load方法。
    // 当require一个模块时，程序会根据模块的名字决定加载执行哪一个封装逻辑；如果没有封装逻辑，那么直接执行原模块：
    utils.wrapMethod(Module, '_load', function wrapLoad(load) {
      return function wrappedLoad(request, parent, isMain) {
        // _load() will invoke _resolveFilename() first time resolving a module.
        const m = load.apply(this, arguments)

        const fileName = resolveFileName(request, parent, isMain)
        // eslint-disable-next-line
        return _postLoad(agent, m, request, fileName)
      }
    })
  },

  unpatchModule: function unpatchModule() {
    const Module = require('module')

    utils.unwrapMethod(Module, '_resolveFilename')
    utils.unwrapMethod(Module, '_load')
  },

  bootstrapInstrumentation: function bootstrapInstrumentation(agent) {
    // Register all the first-party instrumentations.
    Object.keys(INSTRUMENTATIONS).forEach(function forEachInstrumentation(moduleName) {
      const instrInfo = INSTRUMENTATIONS[moduleName]

      const fileName = path.join(__dirname, 'instrumentation', moduleName + '.js')
      shimmer.registerInstrumentation({
        moduleName: moduleName,
        type: instrInfo.type,
        onRequire: _firstPartyInstrumentation.bind(null, agent, fileName)
      })
    })
  },

  registerInstrumentation: function registerInstrumentation(opts) {
    shimmer.registeredInstrumentations[opts.moduleName] = opts
  },

  registeredInstrumentations: Object.create(null),

  /**
   * NOT FOR USE IN PRODUCTION CODE
   *
   * If an instrumented module has a dependency on another instrumented module,
   * and multiple tests are being run in a single test suite with their own
   * setup and teardown between tests, it's possible transitive dependencies
   * will be unwrapped in the module cache in-place (which needs to happen to
   * prevent stale closures from channeling instrumentation data to incorrect
   * agents, but which means the transitive dependencies won't get re-wrapped
   * the next time the parent module is required).
   *
   * Since this only applies in test code, it's not worth the drastic
   * monkeypatching to Module necessary to walk the list of child modules and
   * re-wrap them.
   *
   * Use this to re-apply any applicable instrumentation.
   */
  reinstrument: function reinstrument(modulePath) {
    // eslint-disable-next-line
    return _postLoad(require(modulePath), modulePath)
  },

  /**
   * Given a NodeJS module name, return the name/identifier of our
   * instrumentation.  These two things are usually, but not always,
   * the same.
   */
  getInstrumentationNameFromModuleName(moduleName) {
    return moduleName
  }
})

/**
 * All instrumentation files must export the same interface: a single
 * initialization function that takes the agent and the module to be
 * instrumented.
 */
function instrument(agent, nodule, moduleName) {
  const instrumentation = shimmer.registeredInstrumentations[moduleName]

  if (nodule.hasOwnProperty('__instrumented')) {
    return nodule
  }
  try {
    // onRequire事件是在初始化registeredInstrumentations定义的
    // 加载对应的模块，比如express，把探针绑定上
    if (instrumentation.onRequire(nodule) !== false) {
      nodule.__instrumented = true
    }
  } catch (instrumentationError) {
    agent.emit('responseFinish')
  }

  return nodule
}

function _postLoad(agent, nodule, name, resolvedName) {
  const instrumentation = name

  // Check if this is a known instrumentation and then run it.
  if (shimmer.registeredInstrumentations[instrumentation]) {
    return instrument(agent, nodule, instrumentation, resolvedName)
  }

  return nodule
}
