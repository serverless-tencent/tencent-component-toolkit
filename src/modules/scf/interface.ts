import { RegionType } from './../interface';
import { ApigwRemoveInputs } from './../apigw/interface';

export interface TriggerType {
  NeedCreate?: boolean;
  Type: string;
  TriggerDesc?: string;
  TriggerName?: string;
  Qualifier?: string;
  compared?: boolean;
}

export type OriginTriggerType = {
  [name: string]: { serviceName?: string; name?: string; parameters?: any };
};

export interface Tag {
  Key: string;
  Value: string;
}

export interface FunctionInfo {
  FunctionName: string;
  Namespace: string;
  Timeout: number;
  MemorySize: number;
  Handler: string;
  Runtime: string;
  Status: string;
  LastVersion: string;
  StatusReasons: { ErrorMessage: string }[];
  Traffic?: number;
  ConfigTrafficVersion?: string;
  Tags: Tag[];
  ClsLogsetId: string;
  ClsTopicId: string;
}

export interface ScfPublishVersionInputs {
  functionName?: string;
  description?: string;
  namespace?: string;
  region?: RegionType;
}

export interface PublishVersionAndConfigTraffic {
  traffic: number;
  functionName: string;
  functionVersion: string;
  aliasName: string;
  namespace?: string;
  description?: string;
}

export interface ScfGetAliasInputs {
  functionName: string;
  region: RegionType;
  aliasName?: string;
  namespace?: string;
  functionVersion?: string;
}

export interface ScfUpdateAliasInputs extends ScfGetAliasInputs {
  traffic: number;
  lastVersion: string;
  description?: string;
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

  name: string;
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
    variables?: {
      [key: string]: string;
    };
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

  asyncRunEnable?: undefined | boolean;
  traceEnable?: undefined | boolean;
  installDependency?: undefined | boolean;
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
  events?: OriginTriggerType[];
}

export interface ScfDeployInputs extends ScfCreateFunctionInputs {
  namespace?: string;
  name: string;
  enableRoleAuth?: boolean;
  region?: string;

  lastVersion?: string;
  publish?: boolean;
  publishDescription?: string;

  needSetTraffic?: boolean;
  traffic?: number;

  aliasName?: string;
  aliasDescription?: string;

  tags?: Record<string, string>;

  // FIXME: apigw event type
  events?: OriginTriggerType[];

  // 是否忽略触发器操作流程
  ignoreTriggers?: boolean;
}

export interface ScfDeployOutputs {
  FunctionName: string;
  Runtime: string;
  Namespace: string;
  LastVersion?: string;
  Traffic?: number;
  Tags?: Tag[];
  Triggers?: any[];

  ConfigTrafficVersion?: string;
}

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

export interface FaasBaseConfig {
  functionName: string;
  namespace?: string;
  qualifier?: string;
}

export interface StatusSqlMapEnum {
  success: string;
  fail: string;
  retry: string;
  interrupt: string;
  timeout: string;
  exceed: string;
  codeError: string;
}

export interface GetSearchSqlOptions {
  // 函数名称
  functionName: string;
  // 命名空间
  namespace?: string;
  // 函数版本
  qualifier?: string;
  // 开始时间
  startTime?: number | string;
  // 结束时间
  endTime?: number | string;
  // 请求 ID
  reqId?: string;
  // 日志状态
  status?: keyof StatusSqlMapEnum;
}

export type GetLogOptions = Omit<GetSearchSqlOptions, 'startTime'> & {
  // 时间间隔，单位秒，默认为 3600s
  interval?: string;
};
