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

export interface TriggerInputsParams {}

export interface ApigwTriggerInputsParams extends ApigwDeployInputs {
    created: boolean;

    TriggerDesc:
      | {
          serviceId: string;
        }
      | string;
    ResourceId?: string;
}

export interface ChafkaTriggerInputsParams extends TriggerInputsParams {
  qualifier?: string;
  name?: string;
  topic: string;
  maxMsgNum: number;
  offset: number;
  retry: number;
  enable: boolean;
}

export interface CmqTriggerInputsParams {
  qualifier?: string;
  name: string;
  filterKey: string;
  enable: boolean;
}

export interface ClsTriggerInputsParams {
  qualifier?: string;
  enable: boolean;
  maxSize: number;
  maxWait: number;
  topicId: string;
}

export interface CosTriggerInputsParams {
  qualifier?: string;
  bucket: string;
  events: string;
  filter?: {
    prefix?: string;
    suffix?: string;
  };
  enable: boolean;
}

export interface MpsTriggerInputsParams {
  type: string;
  qualifier?: string;
  enable: boolean;
}

export interface TimerTriggerInputsParams {
  name: string;
  qualifier?: string;
  cronExpression?: string;
  enable: boolean;

  argument?: string;
}

export interface TriggerInputs<P extends TriggerInputsParams = TriggerInputsParams> {
  type: string;
  triggerDesc: string;
  triggerName: string;
  qualifier: string;
  parameters: P;
  name: string;
  functionName: string;
  namespace: string;

  // FIXME:
  FunctionName: string;
  Namespace: string;
  Qualifier: string;
}
