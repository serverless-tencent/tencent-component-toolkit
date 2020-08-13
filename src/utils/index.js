const path = require('path');
const fs = require('fs');

/**
 * is array
 * @param obj object
 */
function isArray(obj) {
  return Object.prototype.toString.call(obj) == '[object Array]';
}

/**
 * is object
 * @param obj object
 */
function isObject(obj) {
  return obj === Object(obj);
}

/**
 * iterate object or array
 * @param obj object or array
 * @param iterator iterator function
 */
function _forEach(obj, iterator) {
  if (isArray(obj)) {
    const arr = obj;
    if (arr.forEach) {
      arr.forEach(iterator);
      return;
    }
    for (let i = 0; i < arr.length; i += 1) {
      iterator(arr[i], i, arr);
    }
  } else {
    const oo = obj;
    for (const key in oo) {
      if (obj.hasOwnProperty(key)) {
        iterator(oo[key], key, obj);
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
    return {};
  }
  const ret = {};
  const _dump = function(obj, prefix, parents) {
    const checkedParents = [];
    if (parents) {
      let i;
      for (i = 0; i < parents.length; i++) {
        if (parents[i] === obj) {
          throw new Error('object has circular references');
        }
        checkedParents.push(obj);
      }
    }
    checkedParents.push(obj);
    if (!isArray(obj) && !isObject(obj)) {
      if (!prefix) {
        throw obj + 'is not object or array';
      }
      ret[prefix] = obj;
      return {};
    }

    if (isArray(obj)) {
      // it's an array
      _forEach(obj, function(o, i) {
        _dump(o, prefix ? prefix + '.' + i : '' + i, checkedParents);
      });
    } else {
      // it's an object
      _forEach(obj, function(o, key) {
        _dump(o, prefix ? prefix + '.' + key : '' + key, checkedParents);
      });
    }
  };

  _dump(source, null);
  return ret;
}

function uniqueArray(arr) {
  return arr.filter((item, index, self) => {
    return self.indexOf(item) === index;
  });
}

function camelCase(str) {
  if (str.length <= 1) {
    return str.toUpperCase();
  }
  return `${str[0].toUpperCase()}${str.slice(1)}`;
}

function camelCaseProperty(obj) {
  let res = null;
  if (isObject(obj)) {
    res = {};
    Object.keys(obj).forEach((key) => {
      const val = obj[key];
      res[camelCase(key)] = isObject(val) || isArray(val) ? camelCaseProperty(val) : val;
    });
  }
  if (isArray(obj)) {
    res = [];
    obj.forEach((item) => {
      res.push(isObject(item) || isArray(item) ? camelCaseProperty(item) : item);
    });
  }
  return res;
}

function strip(num, precision = 12) {
  return +parseFloat(num.toPrecision(precision));
}

function traverseDirSync(dir, opts, ls) {
  if (!ls) {
    ls = [];
    dir = path.resolve(dir);
    opts = opts || {};
    if (opts.depthLimit > -1) {
      opts.rootDepth = dir.split(path.sep).length + 1;
    }
  }
  const paths = fs.readdirSync(dir).map((p) => dir + path.sep + p);
  for (let i = 0; i < paths.length; i++) {
    const pi = paths[i];
    const st = fs.statSync(pi);
    const item = { path: pi, stats: st };
    const isUnderDepthLimit =
      !opts.rootDepth || pi.split(path.sep).length - opts.rootDepth < opts.depthLimit;
    const filterResult = opts.filter ? opts.filter(item) : true;
    const isDir = st.isDirectory();
    const shouldAdd = filterResult && (isDir ? !opts.nodir : !opts.nofile);
    const shouldTraverse = isDir && isUnderDepthLimit && (opts.traverseAll || filterResult);
    if (shouldAdd) {
      ls.push(item);
    }
    if (shouldTraverse) {
      ls = traverseDirSync(pi, opts, ls);
    }
  }
  return ls;
}

module.exports = {
  isArray,
  isObject,
  _forEach,
  flatten,
  uniqueArray,
  camelCaseProperty,
  strip,
  traverseDirSync,
};
