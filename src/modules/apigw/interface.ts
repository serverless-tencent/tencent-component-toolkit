import { RegionType, TagInput } from '../interface';

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

  secrets?: { secretIds?: string[]; created: boolean };
}

export interface ApigwSetupUsagePlanOutputs extends ApigwSetupUsagePlanInputs {}

export interface ApigwSetupUsagePlanSecretInputs {
  /** 要使用的密钥 id 列表 */
  secretIds?: string[];
  /** 用户自定义的密钥名 */
  secretName?: string;
  created?: boolean;
}
export interface ApigwBindUsagePlanInputs {
  apiId?: string;
  serviceId?: string;
  environment?: EnviromentType;
  usagePlanConfig: ApigwSetupUsagePlanInputs;
  authConfig?: ApigwSetupUsagePlanSecretInputs;
}

export interface ApigwBindUsagePlanOutputs extends ApigwBindUsagePlanInputs {}

export interface ApiEndpoint {
  created?: boolean;
  apiId?: string;
  usagePlan?: ApigwSetupUsagePlanInputs;
  auth?: ApigwSetupUsagePlanSecretInputs;
  authType?: 'NONE' | string;
  businessType?: 'NORMAL' | string;
  path?: string;
  method?: string;
  apiName?: string;
  protocol?: 'HTTP' | 'HTTPS' | 'WEBSOCKET';
  description?: string;
  serviceType?: 'SCF' | string;
  serviceTimeout?: 15;
  responseType?: 'HTML' | string;
  enableCORS?: boolean;
  authRelationApiId?: string;
  authRelationApi?: {
    method: string;
    path: string;
  };
  function?: {
    functionName?: string;
    functionNamespace?: string;
    functionQualifier?: string;
    transportFunctionName?: string;
    registerFunctionName?: string;
  };
  internalDomain?: string;
  isBase64Encoded?: boolean;
  isBase64Trigger?: boolean;
  base64EncodedTriggerRules?: { name: string; value: string[] }[];
  serviceMockReturnMessage?: string;
  serviceConfig?: {
    url?: string;
    path?: string;
    method?: string;
  };
  oauthConfig?: {
    loginRedirectUrl: string;
    publicKey: string;
    tokenLocation: string;
  };
}

export interface ApigwCustomDomain {
  domain: string;
  protocols?: ('http' | 'https')[] | string;

  certificateId?: string;
  isDefaultMapping?: boolean;
  pathMappingSet?: { path: string; environment: string }[];
  netType?: string;

  isForcedHttps?: boolean;

  subDomain?: string;
  created?: boolean;
}

export interface ApigwBindCustomDomainInputs {
  customDomains?: ApigwCustomDomain[];
  protocols: ('http' | 'https')[] | string;
  oldState?: Partial<ApigwBindCustomDomainInputs>;
}

export interface ApigwCreateServiceInputs {
  environment?: EnviromentType;
  protocols: ('http' | 'https')[] | string;
  netTypes?: string[];
  serviceName?: string;
  serviceDesc?: string;
  serviceId?: string;

  usagePlan?: ApigwSetupUsagePlanInputs;
  auth?: ApigwSetupUsagePlanSecretInputs;

  tags?: TagInput[];
}
export interface ApigwUpdateServiceInputs {
  environment?: EnviromentType;
  protocols: ('http' | 'https')[] | string;
  netTypes?: string[];
  serviceName?: string;
  serviceDesc?: string;
  serviceId: string;

  usagePlan?: ApigwSetupUsagePlanInputs;
  auth?: ApigwSetupUsagePlanSecretInputs;
}
export interface ApigwCreateOrUpdateServiceOutputs {
  serviceName: string;
  serviceId: string;
  subDomain: string | string[];
  serviceCreated: boolean;
  usagePlan?: undefined | ApigwSetupUsagePlanInputs;
}

export type ApiDeployOutputs = ApiEndpoint;

export interface CreateOrUpdateApiInputs {
  serviceId?: string;
  endpoint?: ApiEndpoint;
  environment?: EnviromentType;
  created?: boolean;
}

export interface UpdateApiInputs {
  serviceId: string;
  endpoint: ApiEndpoint;
  environment: EnviromentType;
  created?: boolean;
}

export interface ApiDeployInputs {
  serviceId: string;
  environment: EnviromentType;
  apiList: ApiEndpoint[];
  oldList: ApiEndpoint[];
  apiConfig: ApiEndpoint;
  isOauthApi?: boolean;
}

export interface ApigwDeployInputs extends ApigwCreateServiceInputs, ApigwBindCustomDomainInputs {
  region?: RegionType;
  oldState?: any;
  environment?: EnviromentType;

  endpoints?: ApiEndpoint[];
  isInputServiceId?: boolean;
  isRemoveTrigger?: boolean;
}

export type ApigwDeployWithServiceIdInputs = ApigwDeployInputs & { serviceId: string };
export interface ApiBulkDeployInputs {
  serviceId: string;
  environment: EnviromentType;
  stateList: any;
  apiList: ApiEndpoint[];
}

export interface ApigwBindCustomDomainOutputs {
  isBinded: boolean;
  created?: boolean;
  subDomain: string;
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
  subDomain: string | string[];
  protocols: string | ('http' | 'https')[];
  environment: EnviromentType;
  apiList: ApiEndpoint[];
  customDomains?: ApigwBindCustomDomainOutputs[];
  usagePlan?: ApigwUsagePlanOutputs;

  tags?: TagInput[];
}

export interface ApigwRemoveOrUnbindUsagePlanInputs {
  serviceId: string;
  environment: EnviromentType;
  usagePlan: ApigwSetupUsagePlanInputs;
  apiId?: string;
}

export interface ApigwRemoveUsagePlanInputs {
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

export interface ApiRemoveInputs {
  apiConfig: ApiEndpoint;
  serviceId: string;
  environment: EnviromentType;
}
export interface ApiBulkRemoveInputs {
  apiList: ApiEndpoint[];
  serviceId: string;
  environment: EnviromentType;
}

export interface ApigwRemoveInputs {
  created?: boolean;
  environment: EnviromentType;
  serviceId: string;
  apiList: ApiEndpoint[];
  customDomains?: ApigwBindCustomDomainOutputs[];
  usagePlan?: ApigwSetupUsagePlanInputs;
  isInputServiceId?: boolean;
  isRemoveTrigger?: boolean;
}

export interface ApiDetail {
  ApiId: string;
  InternalDomain: string;
}
