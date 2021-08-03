import { PascalCase, CamelCase } from 'type-fest';

export enum ApiServiceType {
  // account 账号信息
  account = 'account',

  /** API 网关服务 (apigateway) */
  apigateway = 'apigateway',
  apigw = 'apigw',
  /** 云函数服务 (SCF) */
  scf = 'scf',
  /** 视频处理服务 (MPS) */
  mps = 'mps',
  /** 资源标签服务 (TAG) */
  tag = 'tag',
  /** 内容分发 (CDN) */
  cdn = 'cdn',
  /** 文件存储 (CFS) */
  cfs = 'cfs',
  /** 域名解析服务 (CNS) */
  cns = 'cns',
  /**  */
  domain = 'domain',
  /** MySQL 数据库 (CynosDB) */
  cynosdb = 'cynosdb',
  /** Postgres 数据库 (Postgres) */
  postgres = 'postgres',
  /** 私有网络 (VPC) */
  vpc = 'vpc',
  /* 访问管理 （CAM）  */
  cam = 'cam',

  // 负载均衡 （CLB）*/
  clb = 'clb',

  // 监控 */
  monitor = 'monitor',

  // asw 状态机
  asw = 'asw',

  // asw 状态机
  tcr = 'tcr',

  // 日志服务
  cls = 'cls',
}

export type RegionType = string;

export interface CapiCredentials {
  AppId?: string;
  SecretId?: string;
  SecretKey?: string;
  Token?: string;

  token?: string;
  XCosSecurityToken?: string;
}

export interface Tag {
  Key: string;
  Value: string;
}
export interface TagInput {
  key: string;
  value: string;
}

export type CamelCasedProps<T> = {
  [K in keyof T as CamelCase<K>]: T[K] extends Array<infer U> | undefined
    ? Array<U>
    : CamelCasedProps<T[K]>;
};
export type PascalCasedProps<T> = {
  [K in keyof T as PascalCase<K>]: T[K] extends Array<infer U> | undefined
    ? Array<U>
    : PascalCasedProps<T[K]>;
};
