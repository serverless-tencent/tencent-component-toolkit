const fs = require('fs');
const path = require('path');
const { DescribeDomains } = require('./apis');

const ONE_SECOND = 1000;
// timeout 5 minutes
const TIMEOUT = 5 * 60 * ONE_SECOND;

function getPathContent(target) {
  let content = '';

  try {
    const stat = fs.statSync(target);
    if (stat.isFile()) {
      if (path.isAbsolute(target)) {
        content = fs.readFileSync(target, 'base64');
      } else {
        content = fs.readFileSync(path.join(process.cwd(), target), 'base64');
      }
    }
  } catch (e) {
    // target is string just return
    content = target;
  }
  return content;
}

/**
 * format certinfo
 * @param {object} certInfo cert info
 */
function formatCertInfo(certInfo) {
  if (certInfo.CertId) {
    return {
      CertId: certInfo.CertId,
    };
  }
  return {
    Certificate: getPathContent(certInfo.Certificate),
    PrivateKey: getPathContent(certInfo.PrivateKey),
    Message: certInfo.remarks || '',
  };
}

function formatOrigin(origin) {
  const originInfo = {
    Origins: origin.Origins,
    OriginType: origin.OriginType,
    OriginPullProtocol: origin.OriginPullProtocol,
    ServerName: origin.ServerName,
  };
  if (origin.OriginType === 'cos') {
    originInfo.ServerName = origin.Origins[0];
    originInfo.CosPrivateAccess = 'off';
  }
  if (origin.OriginType === 'domain') {
    if (origin.BackupOrigins) {
      originInfo.BackupOrigins = origin.BackupOrigins;
      originInfo.BackupOriginType = 'domain';
      originInfo.BackupServerName = origin.BackupServerName;
    }
  }
  return originInfo;
}

function isObject(obj) {
  const type = Object.prototype.toString.call(obj).slice(8, -1);
  return type === 'Object';
}

function isArray(obj) {
  const type = Object.prototype.toString.call(obj).slice(8, -1);
  return type === 'Array';
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

function formatCache(caches) {
  return caches.map((cache) => [cache.type, cache.rule, cache.time]);
}

function formatRefer(refer) {
  return refer ? [refer.type, refer.list, refer.empty] : [];
}

async function getCdnByDomain(capi, domain) {
  const { Domains } = await DescribeDomains(capi, {
    Filters: [{ Name: 'domain', Value: [domain] }],
  });

  if (Domains && Domains.length) {
    return Domains[0];
  }
  return undefined;
}

function flushEmptyValue(obj) {
  const newObj = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      newObj[key] = obj[key];
    }
  });

  return newObj;
}

module.exports = {
  ONE_SECOND,
  TIMEOUT,
  formatCache,
  formatRefer,
  getCdnByDomain,
  getPathContent,
  formatCertInfo,
  formatOrigin,
  camelCaseProperty,
  flushEmptyValue,
};
