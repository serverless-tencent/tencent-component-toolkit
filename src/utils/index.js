/**
 * is array
 * @param obj object
 */
function isArray(obj) {
  return Object.prototype.toString.call(obj) == '[object Array]'
}

/**
 * is object
 * @param obj object
 */
function isObject(obj) {
  return obj === Object(obj)
}

/**
 * iterate object or array
 * @param obj object or array
 * @param iterator iterator function
 */
function _forEach(obj, iterator) {
  if (isArray(obj)) {
    const arr = obj
    if (arr.forEach) {
      arr.forEach(iterator)
      return
    }
    for (let i = 0; i < arr.length; i += 1) {
      iterator(arr[i], i, arr)
    }
  } else {
    const oo = obj
    for (const key in oo) {
      if (obj.hasOwnProperty(key)) {
        iterator(oo[key], key, obj)
      }
    }
  }
}

/**
 * flatter request parameter
 * @param source target object or array
 */
function flatten(source) {
  if (!isArray(source) && !isObject(source)) {
    return {}
  }
  const ret = {}
  const _dump = function(obj, prefix, parents) {
    const checkedParents = []
    if (parents) {
      let i
      for (i = 0; i < parents.length; i++) {
        if (parents[i] === obj) {
          throw new Error('object has circular references')
        }
        checkedParents.push(obj)
      }
    }
    checkedParents.push(obj)
    if (!isArray(obj) && !isObject(obj)) {
      if (!prefix) {
        throw obj + 'is not object or array'
      }
      ret[prefix] = obj
      return {}
    }

    if (isArray(obj)) {
      // it's an array
      _forEach(obj, function(o, i) {
        _dump(o, prefix ? prefix + '.' + i : '' + i, checkedParents)
      })
    } else {
      // it's an object
      _forEach(obj, function(o, key) {
        _dump(o, prefix ? prefix + '.' + key : '' + key, checkedParents)
      })
    }
  }

  _dump(source, null)
  return ret
}

module.exports = {
  isArray,
  isObject,
  _forEach,
  flatten
}
