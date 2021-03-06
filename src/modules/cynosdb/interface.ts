import { RegionType, TagInput } from './../interface';

export interface VpcConfig {
  vpcId: string;
  subnetId: string;
}

export interface CynosdbDeployInputs {
  clusterId?: string;
  region?: RegionType;
  zone?: string;
  vpcConfig?: VpcConfig;
  projectId?: string;
  dbVersion?: string;
  dbType?: 'MYSQL' | string;
  port?: number;
  cpu?: number;
  memory?: number;
  storageLimit?: number;
  instanceCount?: number;
  adminPassword?: string;
  payMode?: number;
  timeSpan?: number;
  timeUnit?: string;
  autoVoucher?: number;
  dbMode?: 'SERVERLESS' | 'NORMAL';
  minCpu?: number;
  maxCpu?: number;
  autoPause?: string;
  autoPauseDelay?: 3600;
  enablePublicAccess?: boolean;
  tags?: TagInput[];
}

export interface CynosdbDeployOutputs {
  clusterId?: string;
  adminPassword?: string;

  dbMode?: 'SERVERLESS' | 'NORMAL';
  region?: RegionType;
  zone?: string;
  vpcConfig?: VpcConfig;
  instanceCount: number;

  minCpu?: number;
  maxCpu?: number;

  connection?: {
    ip: string;
    port: string;
  };

  publicConnection?: {
    domain: string;
    ip: string;
    port: string;
  };

  instances?: {
    id: string;
    name: string;
    role: string;
    type: string;
    status: string;
  }[];

  tags?: TagInput[];
}

export interface CynosdbRemoveInputs {
  clusterId?: string;
}

export interface CynosdbResetPwdInputs {
  clusterId?: string;
  adminName?: string;
  host?: string;
  adminPassword?: string;
}

export interface ZoneSetInterface {
  IsSupportNormal: number;
  IsSupportServerless: number;
  ZoneId: number;
  Zone: string;
  ZoneZh: string;
  Region?: string;
  DbType?: string;
}
export interface RegionSetInterface {
  DbType: string;
  Region: string;
  RegionZh: string;
  RegionId: number;
  ZoneSet: ZoneSetInterface[];
}
