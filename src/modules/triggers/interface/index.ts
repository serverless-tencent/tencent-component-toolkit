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
  enable?: boolean;
}
export interface TimerTriggerInputsParams {
  name?: string;
  qualifier?: string;
  cronExpression?: string;
  enable?: boolean;

  argument?: string;
}

export interface TriggerInputs<P extends TriggerInputsParams = TriggerInputsParams> {
  functionName: string;
  type?: string;
  triggerDesc?: string;
  triggerName?: string;
  qualifier?: string;
  parameters?: P;
  name?: string;
  namespace?: string;

  // FIXME:
  FunctionName?: string;
  Namespace?: string;
  Qualifier?: string;
}

export * from './clb';
