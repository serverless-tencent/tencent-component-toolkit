module.exports = {
  /**
   * Detects if the given function has already been wrapped.
   *
   * @param {function} fn - The function to look for a wrapper on.
   *
   * @return {bool} True if `fn` exists and has an attached original, else false.
   */
  isWrapped: function isWrapped(fn) {
    return !!(fn && fn.__original)
  },

  /**
   * Don't throw, but do log and bail out if wrapping fails.
   *
   * Provide an escape hatch by creating a closure around the original method
   * and object / module wrapped into a helper function that will restore the
   * original function / method. See Sinon for a systematic use of this
   * pattern.
   *
   * @param {object} nodule Class or module containing the function to wrap.
   * @param {string} methods One or more names of methods or functions to extract
   *                         and wrap.
   * @param {function} wrapper A generator that, when called, returns a
   *                           wrapped version of the original function.
   */
  wrapMethod: function wrapMethod(nodule, methods, wrapper) {
    if (!methods) {
      return
    }
    if (!Array.isArray(methods)) {
      methods = [methods]
    }

    methods.forEach(function cb_forEach(method) {
      if (!nodule) {
        return
      }

      if (!wrapper) {
        return
      }

      const original = nodule[method]

      if (!original) {
        return
      }
      if (original.__unwrap) {
        return
      }

      const wrapped = wrapper(original, method)
      Object.keys(original).forEach((key) => {
        wrapped[key] = original[key]
      })
      wrapped.__original = original
      wrapped.__unwrap = function __unwrap() {
        nodule[method] = original
      }
      nodule[method] = wrapped
    })
  },

  unwrapMethod: function unwrapMethod(nodule, method) {
    if (!method) {
      return
    }

    if (!nodule) {
      return
    }

    const wrapped = nodule[method]

    if (!wrapped) {
      return
    }
    if (!wrapped.__unwrap) {
      return
    }

    wrapped.__unwrap()
  },

  /**
   * Determines if the given object exists and is a function.
   * @param {*} obj - The object to check.
   *
   * @return {bool} True if the object is a function, else false.
   */
  isFunction: function isFunction(obj) {
    return typeof obj === 'function'
  }
}
