import { RegionType } from './../interface';
import { ApigwRemoveInputs } from './../apigw/interface';

export interface FunctionCode {
  CosBucketName?: string;
  CosObjectName?: string;

  // 镜像部署代码
  ImageConfig?: {
    ImageType: string;
    ImageUri: string;
    RegistryId?: string;
    Command?: string;
    Args?: string;
    ContainerImageAccelerate?: boolean;
    ImagePort?: number;
  };
}

export interface WSParams {
  idleTimeOut?: number;
  IdleTimeOut?: number;
}
export interface ProtocolParams {
  wsParams?: WSParams;
  WSParams?: WSParams;
}

export interface BaseFunctionConfig {
  FunctionName: string;
  Code?: FunctionCode;
  Handler?: string;
  Runtime?: string;
  Namespace?: string;
  Timeout?: number;
  InitTimeout?: number;
  MemorySize?: number;
  DiskSize?: number;
  Type?: 'HTTP' | 'Event';
  DeployMode?: 'code' | 'image';
  PublicNetConfig?: {
    PublicNetStatus: 'ENABLE' | 'DISABLE';
    EipConfig: {
      EipStatus: 'ENABLE' | 'DISABLE';
    };
  };
  L5Enable?: 'TRUE' | 'FALSE';
  Role?: string;
  Description?: string;
  ClsLogsetId?: string;
  ClsTopicId?: string;
  Environment?: { Variables: { Key: string; Value: string }[] };
  VpcConfig?: { VpcId?: string; SubnetId?: string };
  Layers?: { LayerName: string; LayerVersion: number }[];
  DeadLetterConfig?: { Type?: string; Name?: string; FilterType?: string };
  CfsConfig?: {
    CfsInsList: {
      CfsId: string;
      MountInsId: string;
      LocalMountDir: string;
      RemoteMountDir: string;
      UserGroupId: string;
      UserId: string;
    }[];
  };
  AsyncRunEnable?: 'TRUE' | 'FALSE';
  TraceEnable?: 'TRUE' | 'FALSE';
  InstallDependency?: 'TRUE' | 'FALSE';
  ProtocolType?: string;
  ProtocolParams?: ProtocolParams;
  NodeType?: string;
  NodeSpec?: string;
  InstanceConcurrencyConfig?: { DynamicEnabled: 'TRUE' | 'FALSE'; MaxConcurrency?: number };
}

export interface TriggerType {
  NeedCreate?: boolean;
  Type: string;
  TriggerDesc?: string;
  TriggerName?: string;
  Qualifier?: string;
  compared?: boolean;
  tags?: object;
  parameters?: any;
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
  Qualifier: string;
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
  description?: string;
  additionalVersions?: { version: string; weight: number }[];
}

export type ScfDeleteAliasInputs = ScfGetAliasInputs;
export interface ScfListAliasInputs extends ScfGetAliasInputs {}

export interface ScfCreateAlias {
  functionName: string;
  functionVersion?: string;
  aliasName: string;
  namespace?: string;
  lastVersion?: string;
  traffic?: number;
  description?: string;
  additionalVersions?: { version: string; weight: number }[];
}

export interface ScfCreateFunctionInputs {
  // FIXME:
  Namespace?: string;

  name: string;
  type?: string;
  deployMode?: string;
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
  diskSize?: number;
  publicAccess?: boolean;
  eip?: boolean;
  l5Enable?: boolean;
  // 资源类型
  nodeType?: string;
  // 资源配置
  nodeSpec?: string;

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
    mountInsId?: string;
    MountInsId?: string;
    localMountDir: string;
    remoteMountDir: string;
    userGroupId?: string;
    userId?: string;
  }[];

  qualifier?: string;

  asyncRunEnable?: undefined | boolean;
  traceEnable?: undefined | boolean;
  installDependency?: undefined | boolean;

  // 镜像
  imageConfig?: {
    // 镜像类型：enterprise - 企业版、personal - 个人版
    imageType: string;
    // 镜像地址
    imageUri: string;
    // 仓库 ID
    registryId?: string;
    // 启动命令
    command?: string;
    // 启动命令参数
    args?: string;
    // 是否开启镜像加速
    containerImageAccelerate?: boolean;
    // 监听端口: -1 表示job镜像,0~65535 表示Web Server镜像
    imagePort?: number;
  };

  // 异步调用重试配置
  msgTTL?: number; // 消息保留时间，单位秒
  retryNum?: number; // 重试次数

  protocolType?: string;
  protocolParams?: ProtocolParams;

  // 请求多并发配置
  instanceConcurrencyConfig?: {
    enable: boolean; // 是否开启多并发
    dynamicEnabled: boolean; // 是否开启动态配置
    maxConcurrency: number; // 最大并发数
  };
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

  // 版本相关配置
  lastVersion?: string;
  publish?: boolean;
  publishDescription?: string;
  needSetTraffic?: boolean;
  traffic?: number;

  // 别名相关配置
  aliasName?: string;
  aliasDescription?: string;
  aliasFunctionVersion?: string;
  additionalVersionWeights?: { version: string; weight: number }[];

  tags?: Record<string, string>;

  // FIXME: apigw event type
  events?: OriginTriggerType[];

  // 是否忽略触发器操作流程
  ignoreTriggers?: boolean;
  protocolType?: string;
  protocolParams?: ProtocolParams;
}

export interface ScfDeployOutputs {
  FunctionName: string;
  Type: string;
  Timeout: number;
  MemorySize: number;
  Handler?: string;
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

  Triggers?: ApigwRemoveInputs[] | Record<string, any>[];
  triggers?: ApigwRemoveInputs[] | Record<string, any>[];

  // 是否自动发布 API 网关
  isAutoRelease?: boolean;
}

export interface ScfInvokeInputs {
  functionName: string;
  namespace?: string;
  qualifier?: string;
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

export interface UpdateFunctionCodeOptions {
  Action: any;
  Handler: string;
  FunctionName: string;
  Namespace: string;
  InstallDependency?: string;

  // cos 方式
  CosBucketName?: string;
  CosObjectName?: string;

  // image 方式
  Code?: FunctionCode;
}

export interface GetRequestStatusOptions {
  // 函数名称
  functionName: string;
  // 请求ID
  functionRequestId: string;
  // 命名空间
  namespace?: string;
  // 开始时间
  startTime?: string;
  // 结束时间
  endTime?: string;
}

export interface GetRequestStatusOptions {
  /**
   * 函数名称
   */
  functionName: string;

  /**
   * 需要查询状态的请求id
   */
  functionRequestId: string;

  /**
   * 函数的所在的命名空间
   */
  namespace?: string;

  /**
   * 查询的开始时间，例如：2017-05-16 20:00:00，不填默认为当前时间 - 15min
   */
  startTime?: string;

  /**
   * 查询的结束时间，例如：2017-05-16 20:59:59，不填默认为当前时间。EndTime 需要晚于 StartTime。
   */
  endTime?: string;
}
