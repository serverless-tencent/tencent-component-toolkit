import { ApigwDeployInputs, ApiEndpoint } from '../../apigw/interface';

export interface ApigwTriggerRemoveScfTriggerInputs {
  serviceId: string;
  apiId: string;
  functionName: string;
  namespace: string;
  qualifier: string;
}

export interface ApigwTriggerRemoveInputs {
  serviceId: string;
  apiId: string;
}

export interface EndpointFunction extends ApiEndpoint {
  functionName: string;
  functionNamespace: string;
  functionQualifier: string;
}

export interface TriggerInputsParams {
  // Type?:string;
  // TriggerDesc?:string;
  // TriggerName?: string;
  // Qualifier?: string
}

export interface ApigwTriggerInputsParams extends ApigwDeployInputs {
  created: boolean;

  TriggerDesc:
    | {
        serviceId: string;
        path: string;
        method: string;
      }
    | string;
  ResourceId?: string;
}

export type TriggerType = 'scf' | 'timer' | string;
export interface CreateTriggerReq {
  Action?: 'CreateTrigger';
  ResourceId?: string;
  FunctionName?: string;
  Namespace?: string;
  Type?: TriggerType;
  Qualifier?: string;
  TriggerName?: string;
  TriggerDesc?: any;
  Enable?: 'OPEN' | 'CLOSE' | 1 | 0;
  CustomArgument?: any;
}

export interface CkafkaTriggerInputsParams extends TriggerInputsParams {
  qualifier?: string;
  name?: string;
  topic?: string;
  maxMsgNum?: number;
  offset?: number;
  retry?: number;
  timeout?: number;
  enable?: boolean;
}

export interface CmqTriggerInputsParams {
  qualifier?: string;
  name?: string;
  filterKey?: string;
  enable?: boolean;
}

export interface ClsTriggerInputsParams {
  qualifier?: string;
  enable?: boolean;
  maxSize?: number;
  maxWait?: number;
  topicId?: string;
}

export interface CosTriggerInputsParams {
  qualifier?: string;
  bucket?: string;
  events?: string;
  filter?: {
    prefix?: string;
    suffix?: string;
  };
  enable?: boolean;
}

export interface MpsTriggerInputsParams {
  type?: string;
  qualifier?: string;
  namespace?: string;
  enable?: boolean;
}
export interface TimerTriggerInputsParams {
  name?: string;
  qualifier?: string;
  cronExpression?: string;
  enable?: boolean;

  argument?: string;
  namespace?: string;
}

export interface TriggerInputs<P extends TriggerInputsParams = TriggerInputsParams> {
  functionName: string;
  type?: string;
  triggerDesc?: string;
  triggerName?: string;
  qualifier?: string;
  name?: string;
  namespace?: string;
  parameters?: P;

  function?: {
    qualifier?: string;
    name?: string;
    namespace?: string;
  };

  // FIXME:
  FunctionName?: string;
  Namespace?: string;
  Qualifier?: string;

  // 是否自动发布服务（API 网关特有）
  isAutoRelease?: boolean;
}

export interface TriggerDetail {
  NeedCreate?: boolean;
  Type: string;
  TriggerDesc?: string;
  TriggerName?: string;
  Qualifier?: string;
  compared?: boolean;

  triggerType: string;

  [key: string]: any;
}

export interface NewTriggerInputs {
  type: string;

  function?: {
    name: string;
    namespace?: string;
    qualifier?: string;
  };

  parameters: {
    endpoints?: ApiEndpoint[];
    [key: string]: any;
  };
}

export * from './clb';

export interface SimpleApigwDetail {
  // 是否是通过 CLI 创建的
  created?: boolean;
  // 当前触发器关联函数名称
  functionName: string;
  // 服务 ID
  serviceId: string;
  // 服务名称
  serviceName: string;
  // 发布的环境
  environment: string;
}
