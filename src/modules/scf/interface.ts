import { RegionType } from './../interface';
import { ApigwRemoveInputs } from './../apigw/interface';

export interface TriggerType {
  Type: string;
  TriggerDesc: string;
  TriggerName: string;
  Qualifier: string;
}

export type EventType = Record<string, any>;

export interface FunctionInfo {
  FunctionName: string;
  Namespace: string;
  Timeout: number;
  MemorySize: number;
  Handler: string;
}

export interface ScfPublishVersionInputs {
  functionName?: string;
  description?: string;
  namespace?: string;
  region?: RegionType;
}

export interface publishVersionAndConfigTraffic {
  traffic: number;
  functionName: string;
  functionVersion: string;
  aliasName: string;
  namespace?: string;
  description?: string;
}

export interface ScfUpdateAliasInputs extends ScfGetAliasInputs {
  traffic: number;
  lastVersion: string;
  description?: string;
}

export interface ScfGetAliasInputs {
  functionName: string;
  region: RegionType;
  aliasName?: string;
  namespace?: string;
  functionVersion?: string;
}

export type ScfDeleteAliasInputs = ScfGetAliasInputs;
export interface ScfListAliasInputs extends ScfGetAliasInputs {}

export interface ScfCreateAlias {
  functionName: string;
  functionVersion: string;
  aliasName: string;
  namespace?: string;
  lastVersion: string;
  traffic: number;
  description?: string;
}

export interface ScfCreateFunctionInputs {
  // FIXME:
  Namespace?: string;

  name?: string;
  code?: {
    bucket: string;
    object: string;
  };
  handler?: string;
  runtime?: string;
  namespace?: string;
  timeout?: number;
  initTimeout?: number;
  memorySize?: number;
  publicAccess?: boolean;
  eip?: boolean;
  l5Enable?: boolean;

  role?: string;
  description?: string;

  cls?: {
    logsetId?: string;
    topicId?: string;
  };

  environment?: {
    variables?: [key: string, value: string][];
  };

  vpcConfig?: {
    vpcId: string;
    subnetId: string;
  };

  layers?: {
    name: string;
    version: number;
  }[];

  deadLetter?: {
    type?: string;
    name?: string;
    filterType?: string;
  };

  cfs?: {
    cfsId: string;
    MountInsId?: string;
    localMountDir: string;
    remoteMountDir: string;
    userGroupId?: string;
    userId?: string;
  }[];

  asyncRunEnable?: {};
}

export interface ScfUpdateAliasTrafficInputs {
  traffic: number;
  functionName: string;
  lastVersion: string;
  functionVersion?: string;
  aliasName?: string;
  namespace?: string;
  description?: string;
  region: RegionType;
}

export interface ScfDeployTriggersInputs {
  namespace?: string;
  name?: string;
  events?: TriggerType[];
}

export interface ScfDeployInputs extends ScfCreateFunctionInputs {
  namespace?: string;
  name?: string;
  enableRoleAuth?: boolean;
  region?: string;

  lastVersion?: string;
  publish?: string;
  publishDescription?: string;

  needSetTraffic?: boolean;
  traffic?: number;

  aliasName?: string;
  aliasDescription?: string;

  tags?: Record<string, string>;

  events?: TriggerType[];
}

export interface ScfDeployOutputs {}

export interface ScfRemoveInputs {
  functionName?: string;
  FunctionName?: string;

  namespace?: string;
  Namespace?: string;

  Triggers?: ApigwRemoveInputs[];
}

export interface ScfInvokeInputs {
  functionName: string;
  namespace?: string;
  logType?: string;
  clientContext?: any;
  invocationType?: string;
}
