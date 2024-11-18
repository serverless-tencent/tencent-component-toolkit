import fs from 'fs';
import path from 'path';
import camelCase from 'camelcase';
import { PascalCase } from 'type-fest';
import { CamelCasedProps, PascalCasedProps } from '../modules/interface';
import crypto from 'crypto';

// TODO: 将一些库换成 lodash

/**
 * simple deep clone object
 * @param {object} obj object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * return variable real type
 * @param {any} obj input variable
 */
export function getRealType<T>(obj: T): string {
  return Object.prototype.toString.call(obj).slice(8, -1);
}

/**
 * is array
 * @param obj object
 */
export function isArray<T>(obj: T[] | T): obj is T[] {
  return Object.prototype.toString.call(obj) == '[object Array]';
}

/**
 * is positive integer(正整数)
 * @param obj object
 */
export function isPositiveInteger(value: string | number) {
  return +value > 0 && Number.isInteger(+value);
}

/**
 * is number（数字)
 * @param obj object
 */
export function isNumber(value: string | number) {
  return !Number.isNaN(+value);
}

/**
 * is object
 * @param obj object
 */
export function isObject<T>(obj: T): obj is T {
  return obj === Object(obj);
}

/**
 * iterate object or array
 * @param obj object or array
 * @param iterator iterator function
 */
export function _forEach<T extends object>(
  obj: T[],
  iterator: (val: T, index: number, data?: T[]) => any,
): void;
export function _forEach<T extends object>(
  obj: T,
  iterator: (val: any, index: string, data?: T) => any,
): void;
export function _forEach<T extends object>(
  obj: T | T[],
  iterator: (val: any, index: any, data?: T | T[]) => any,
): void {
  if (isArray(obj)) {
    if (obj.forEach) {
      obj.forEach(iterator);
      return;
    }
    for (let i = 0; i < obj.length; i += 1) {
      iterator(obj[i], i, obj);
    }
  } else {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        iterator(obj[key], key, obj);
      }
    }
  }
}

export function isPrimitive(obj: any): boolean {
  return obj !== Object(obj);
}

export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) {
    return true;
  }

  if (isPrimitive(obj1) || isPrimitive(obj2)) {
    return obj1 === obj2;
  }

  if (Object.keys(obj1).length !== Object.keys(obj2).length) {
    return false;
  }

  // compare objects with same number of keys
  for (const key in obj1) {
    if (!(key in obj2)) {
      return false;
    }
    if (!deepEqual(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
}

/**
 * flatter request parameter
 * @param source target object or array
 */
export function flatten<T extends object>(source: T | T[]) {
  if (!isArray(source) && !isObject(source)) {
    return {};
  }
  const ret: Record<string, any> = {};

  function _dump(obj: any, prefix?: string, parents?: any[]) {
    const checkedParents: any[] = [];
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
    if (!isArray(obj as any) && !isObject(obj)) {
      if (!prefix) {
        throw obj + 'is not object or array';
      }
      ret[prefix] = obj;
      return {};
    }

    if (isArray(obj)) {
      // it's an array
      _forEach(obj, function (o: any, i: number | string) {
        _dump(o, prefix ? prefix + '.' + i : '' + i, checkedParents);
      });
    } else {
      // it's an object
      _forEach(obj, function (o: any, key: string | number) {
        _dump(o, prefix ? prefix + '.' + key : '' + key, checkedParents);
      });
    }
  }

  _dump(source);
  return ret;
}

export function uniqueArray<T>(arr: T[]) {
  return arr.filter((item, index, self) => {
    return self.indexOf(item) === index;
  });
}

export function camelCaseProps<T>(obj: T): CamelCasedProps<T> {
  let res: Record<string, any> = {};
  if (isObject(obj)) {
    res = {} as any;
    Object.keys(obj).forEach((key: string) => {
      const val = (obj as any)[key];
      const k = camelCase(key);
      res[k] = isObject(val) || isArray(val) ? camelCaseProps(val) : val;
    });
  }
  if (isArray(obj as any)) {
    res = [];
    (obj as any).forEach((item: any) => {
      res.push(isObject(item) || isArray(item) ? camelCaseProps(item) : item);
    });
  }
  return res as CamelCasedProps<T>;
}

export function pascalCase<T extends string>(str: T): PascalCase<T> {
  if (str.length <= 1) {
    return str.toUpperCase() as any;
  }
  return `${str[0].toUpperCase()}${str.slice(1)}` as any;
}

export function pascalCaseProps<T>(obj: T): PascalCasedProps<T> {
  let res: Record<string, any> = {};
  if (isObject(obj)) {
    res = {} as any;
    Object.keys(obj).forEach((key: string) => {
      const val = (obj as any)[key];
      const k = pascalCase(key);
      res[k] = isObject(val) || isArray(val) ? pascalCaseProps(val) : val;
    });
  }
  if (isArray(obj as any)) {
    res = [];
    (obj as any).forEach((item: any) => {
      res.push(isObject(item) || isArray(item) ? pascalCaseProps(item) : item);
    });
  }
  return res as PascalCasedProps<T>;
}

export function strip(num: number, precision = 12) {
  return +parseFloat(num.toPrecision(precision));
}

export interface TraverseDirOptions {
  depthLimit?: number;
  rootDepth?: number;
  filter?: (item: { path: string; stats: fs.Stats }) => boolean;
  nodir?: boolean;
  nofile?: boolean;
  traverseAll?: boolean;
}

export function traverseDirSync(
  dir: string,
  opts?: TraverseDirOptions,
  ls?: { path: string; stats: fs.Stats }[],
): { path: string; stats: fs.Stats }[] {
  if (!ls) {
    ls = [];
    dir = path.resolve(dir);
    opts = opts ?? {};
    if (opts?.depthLimit ?? -1 > -1) {
      opts.rootDepth = dir.split(path.sep).length + 1;
    }
  }
  const paths: string[] = fs.readdirSync(dir).map((p: string) => dir + path.sep + p);
  for (let i = 0; i < paths.length; i++) {
    const pi = paths[i];
    const st = fs.statSync(pi);
    const item = { path: pi, stats: st };
    const isUnderDepthLimit =
      !opts?.rootDepth || pi.split(path.sep).length - opts.rootDepth < (opts?.depthLimit ?? -1);
    const filterResult = opts?.filter ? opts.filter(item) : true;
    const isDir = st.isDirectory();
    const shouldAdd = filterResult && (isDir ? !opts?.nodir : !opts?.nofile);
    const shouldTraverse = isDir && isUnderDepthLimit && (opts?.traverseAll || filterResult);
    if (shouldAdd) {
      ls?.push(item);
    }
    if (shouldTraverse) {
      ls = traverseDirSync(pi, opts, ls);
    }
  }
  return ls;
}

export function getToday(date?: Date) {
  if (!date) {
    date = new Date();
  }
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}-${month < 10 ? '0' : ''}${month}-${day}`;
}

export function getYestoday() {
  const timestamp = Date.now() - 24 * 60 * 60 * 1000;
  const yestoday = getToday(new Date(timestamp));
  return yestoday;
}

export const randomId = (len = 6) => {
  const randomStr = Math.random().toString(36);
  return randomStr.substr(-len);
};

export const getQcsResourceId = (service: string, region: string, uin: string, suffix: string) => {
  // 云资源六段式
  return `qcs::${service}:${region}:uin/${uin}:${suffix}`;
};

/**
 * hmacSha1 加密HmacSHA1
 * @param text 加密文本
 * @param key  加密密钥
 * @returns
 */
export const hmacSha1 = (text: string, key: string) => {
  return crypto.createHmac('sha1', key).update(text).digest('hex');
};

/**
 * getYunTiApiUrl 查询云梯API地址
 * @returns 云梯API地址
 */
export const getYunTiApiUrl = (): string => {
  const apiKey = process.env.SLS_YUNTI_API_KEY || '';
  const apiSecret = process.env.SLS_YUNTI_API_SECRET || '';
  const apiUrl = process.env.SLS_YUNTI_API_URL;
  const timeStamp = Math.floor(Date.now() / 1000);
  const apiSign = hmacSha1(`${timeStamp}${apiKey}`, apiSecret);
  const url = `${apiUrl}?api_key=${apiKey}&api_ts=${timeStamp}&api_sign=${apiSign}`;
  return url;
};
