import { RegionType } from '../interface';

export interface Secret {
  AccessKeyId: string;
}

export type EnviromentType = 'release' | 'prepub' | 'test';

export interface ApigwSetupUsagePlanInputs {
  usagePlanId: string;
  usagePlanName?: string;
  usagePlanDesc?: string;
  maxRequestNumPreSec?: number;
  maxRequestNum?: number;
  created?: boolean;
  secrets?: ApigwSetupUsagePlanSecretInputs;
}

export interface ApigwBindUsagePlanInputs {
  apiId?: string;
  serviceId?: string;
  environment?: EnviromentType;
  usagePlanConfig: ApigwSetupUsagePlanInputs;
  authConfig?: ApigwSetupUsagePlanSecretInputs;
}

export interface ApigwSetupUsagePlanSecretInputs {
  secretIds: string[];
  secretName: string;
  created?: boolean;
}

export interface ApigwCreateOrUpdateServiceInputs {
  environment?: EnviromentType;
  protocols: string | ('http' | 'https')[];
  netTypes: string[];
  serviceName?: string;
  serviceDesc?: string;
  serviceId: string;

  usagePlan?: ApigwSetupUsagePlanInputs;
  auth?: ApigwSetupUsagePlanSecretInputs;
}

export type ApiDeployerOutputs = ApiEndpoint;

export interface CreateOrUpdateApiInputs {
  serviceId: string;
  endpoint: ApiEndpoint;
  environment: EnviromentType;
  created: boolean;
}

export interface ApiEndpoint {
  created: boolean;
  apiId?: string;
  usagePlan?: ApigwSetupUsagePlanInputs;
  auth?: ApigwSetupUsagePlanSecretInputs;
  authType?: 'NONE' | string;
  businessType?: 'NORMAL' | string;
  path: string;
  method: string;
  apiName?: string;
  protocol?: 'HTTP' | 'HTTPS';
  description?: string;
  serviceType?: 'SCF' | string;
  serviceTimeout?: 15;
  responseType?: 'HTML' | string;
  enableCORS?: boolean;
  oauthConfig?: string;
  authRelationApiId?: string;
  authRelationApi?: {
    method: string;
    path: string;
  };
  internalDomain?: string;
}

export interface ApiDeployerInputs {
  serviceId: string;
  environment: EnviromentType;
  apiList: ApiEndpoint[];
  oldList: ApiEndpoint[];
  apiConfig: ApiEndpoint;
  isOauthApi?: boolean;
}

export interface ApigwDeployInputs extends ApigwCreateOrUpdateServiceInputs {
  region: RegionType;
  oldState: any;
  environment?: EnviromentType;
  protocols: string | ('http' | 'https')[];

  endpoints: ApiEndpoint[];
}

export interface ApigwBindCustomDomainOutputs {
  isBinded: boolean;
  created?: boolean;
  subDomain: any;
  cname: string;
  url?: string;
  message?: string;
}

export interface ApigwUsagePlanOutputs {
  created?: boolean;
  usagePlanId: string;
}

export interface ApigwDeployOutputs {
  created?: boolean;
  serviceId: string;
  serviceName: string;
  subDomain: string;
  protocols: string;
  environment: EnviromentType;
  apiList: ApiEndpoint[];
  customDomains?: ApigwBindCustomDomainOutputs[];
  usagePlan?: ApigwUsagePlanOutputs;
}

export interface ApigwRemoveOrUnbindUsagePlanInputs {
  serviceId: string;
  environment: EnviromentType;
  usagePlan: ApigwSetupUsagePlanInputs;
  apiId?: string;
}

export interface ApigwApiRemoverInputs {
  apiConfig: ApiEndpoint;
  serviceId: string;
  environment: EnviromentType;
}

export interface ApigwRemoveInputs {
  created: boolean;
  environment: EnviromentType;
  serviceId: string;
  apiList: ApiEndpoint[];
  customDomains: CustomDomain[];
  usagePlan: ApigwSetupUsagePlanInputs;
}

export interface CustomDomain {
  subDomain: string;
  created: boolean;
}
