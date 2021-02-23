import { ApigwDeployInputs, ApiEndpoint } from './../apigw/interface';
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

export type TriggerType = 'scf' | 'timer' | 'ckafka' | 'cls' | 'cmq' | 'cos' | 'mps';

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

export interface TriggerData<D> {
  FunctionName?: string;
  Namespace?: string;
  Type?: TriggerType;
  Qualifier?: string;
  TriggerName?: string;
  TriggerDesc?: D;
  Enable?: 'OPEN' | 'CLOSE';
  CustomArgument?: any;

  ResourceId?: string;

  NeedCreate?: boolean;
}
export interface ApigwTriggerDesc {
  serviceId: string;
}

export type CkafkaTriggerDesc = string;

export interface ClsTriggerDesc {
  effective?: boolean;
  // FIXME: casing
  function_name?: string;
  max_size?: number;
  max_wait?: number;
  name_space?: string;
  // FIXME: casing
  qualifier: string;
  topic_id: string;
}

export type CmqTriggerDesc = string;

export type CosTriggerDesc = string;

export type MpsTriggerDesc = {
  eventType?: string;
};

export type TimerTriggerDesc = string;

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

export interface CkafkaTriggerParams {
  qualifier?: string;
  name?: string;
  topic?: string;
  maxMsgNum?: number;
  offset?: number;
  retry?: number;
  enable?: boolean;
}

export interface CmqTriggerParams {
  qualifier?: string;
  name?: string;
  filterKey?: string;
  enable?: boolean;
}

export interface ClsTriggerParams {
  qualifier?: string;
  enable?: boolean;
  maxSize?: number;
  maxWait?: number;
  topicId?: string;
}

export interface CosTriggerParams {
  qualifier?: string;
  bucket?: string;
  events?: string;
  filter?: {
    prefix?: string;
    suffix?: string;
  };
  enable?: boolean;
}

export interface MpsTriggerParams {
  type?: string;
  qualifier?: string;
  enable?: boolean;
}

export interface TimerTriggerParams {
  name?: string;
  qualifier?: string;
  cronExpression?: string;
  enable?: boolean;

  argument?: string;
}

export interface TriggerInputs<P extends {} = {}> {
  type?: string;
  triggerDesc?: string;
  triggerName?: string;
  qualifier?: string;
  parameters?: P;
  name?: string;
  functionName?: string;
  namespace?: string;

  // FIXME: cls need, spelling error?
  FunctionName?: string;
  Namespace?: string;
  Qualifier?: string;
}
