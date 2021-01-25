import { CertInfo } from './interface';
import { PascalCasedProps } from './../../utils/index';
import { Capi } from '@tencent-sdk/capi';
import fs from 'fs';
import path from 'path';
import APIS from './apis';

export const ONE_SECOND = 1000;
// timeout 5 minutes
export const TIMEOUT = 5 * 60 * ONE_SECOND;

/**
 * 获取证书字符串所代表路径内容
 * @param target
 */
export function getCertPathContent(target: string) {
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
 * 格式化证书内容
 * @param {object} certInfo cert info
 */
export function formatCertInfo(certInfo: PascalCasedProps<CertInfo>): PascalCasedProps<CertInfo> {
  /** 根据 CertId 获取 */
  const idInfo = certInfo as { CertId: string };
  if (idInfo.CertId) {
    return {
      CertId: idInfo.CertId,
    };
  }

  /** 从本地路径获取 */
  const pathInfo = certInfo as { Certificate: string; PrivateKey: string; Remarks: string };
  return {
    Certificate: getCertPathContent(pathInfo.Certificate),
    PrivateKey: getCertPathContent(pathInfo.PrivateKey),
    // FIXME: remarks 必定是大写？
    // Message: pathInfo.remarks,
    Message: pathInfo.Remarks ?? '',
  };
}

/** 格式化源站信息 */
export function formatOrigin(origin: {
  Origins: string[];
  OriginType: string;
  OriginPullProtocol: string;
  ServerName: string;
  BackupOrigins?: string[];
  BackupServerName?: string;
}) {
  const originInfo: {
    Origins: string[];
    OriginType: string;
    OriginPullProtocol: string;
    ServerName: string;
    CosPrivateAccess?: string;
    BackupOrigins?: string[];
    BackupOriginType?: string;
    BackupServerName?: string;
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

/** 格式化缓存信息 */
export function formatCache(caches: { type: string; rule: string; time: string }[]) {
  return caches.map((cache) => [cache.type, cache.rule, cache.time]);
}

/** 格式化回源 Refer 信息 */
export function formatRefer(refer: { type: string; list: string[]; empty: boolean }) {
  return refer ? [refer.type, refer.list, refer.empty] : [];
}

/** 从 CDN 中获取域名 */
export async function getCdnByDomain(capi: Capi, domain: string) {
  const { Domains } = await APIS.DescribeDomains(capi, {
    Filters: [{ Name: 'domain', Value: [domain] }],
  });

  if (Domains && Domains.length) {
    return Domains[0];
  }
  return undefined;
}

/** 启用 CDN 服务 */
export async function openCdnService(capi: Capi) {
  try {
    await APIS.OpenCdnService(capi, {
      PayTypeMainland: 'flux',
      PayTypeOverseas: 'flux',
    });
  } catch (e) {
    if (e.code !== 'ResourceInUse.CdnUserExists') {
      throw e;
    }
  }
}
