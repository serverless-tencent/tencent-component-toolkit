import { Capi } from '@tencent-sdk/capi';
import fs from 'fs';
import path from 'path';
import APIS from './apis';

export const ONE_SECOND = 1000;
// timeout 5 minutes
export const TIMEOUT = 5 * 60 * ONE_SECOND;

export function getPathContent(target: string) {
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
export function formatCertInfo(certInfo: {Certificate: string, PrivateKey: string, remarks: string}): {Certificate: string, PrivateKey: string, Message: string};
export function formatCertInfo(certInfo: {CertId: string}): {CertId: string};
export function formatCertInfo(certInfo: {CertId: string} | {Certificate: string, PrivateKey: string, remarks: string}):any {
  /** 根据 CertId 获取 */
  const idInfo = certInfo as {CertId: string};
  if (idInfo.CertId) {
    return {
      CertId: idInfo.CertId,
    };
  }

  /** 从本地路径获取 */
  const pathInfo = certInfo as {Certificate: string, PrivateKey: string, remarks: string};
  return {
    Certificate: getPathContent(pathInfo.Certificate),
    PrivateKey: getPathContent(pathInfo.PrivateKey),
    Message: pathInfo.remarks ?? '',
  };
}

export function formatOrigin(origin: {
  Origins: string[],
  OriginType: string,
  OriginPullProtocol: string,
  ServerName: string
  BackupOrigins?: string[],
  BackupServerName?: string;
}) {
  const originInfo: {
    Origins: string[],
    OriginType: string,
    OriginPullProtocol: string,
    ServerName: string,
    CosPrivateAccess?: string,
    BackupOrigins?: string[],
    BackupOriginType?: string,
    BackupServerName?: string
  } = {
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

export function formatCache(caches: {type: string, rule: string, time: string}[]) {
  return caches.map((cache) => [cache.type, cache.rule, cache.time]);
}

export function formatRefer(refer: {type: string, list: string[], empty: boolean}) {
  return refer ? [refer.type, refer.list, refer.empty] : [];
}

export async function getCdnByDomain(capi: Capi, domain:string) {
  const { Domains } = await APIS.DescribeDomains(capi, {
    Filters: [{ Name: 'domain', Value: [domain] }],
  });

  if (Domains && Domains.length) {
    return Domains[0];
  }
  return undefined;
}

export function flushEmptyValue<T extends Record<string | number, any>>(obj: T) {
  const newObj:T = {} as T;
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      newObj[key as any] = obj[key];
    }
  });

  return newObj;
}

export async function openCdnService(capi: Capi) {
  try {
    await APIS.OpenCdnService(capi, );
  } catch (e) {
    if (e.code !== 'ResourceInUse.CdnUserExists') {
      throw e;
    }
  }
}

