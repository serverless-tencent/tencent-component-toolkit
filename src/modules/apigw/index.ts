import { RegionType } from '../interface';
import { Capi } from '@tencent-sdk/capi';
import { ApigwTrigger } from '../triggers';
import { uniqueArray, camelCaseProperty, isArray, deepClone } from '../../utils';
import { ApiTypeError } from '../../utils/error';
import { CapiCredentials, ApiServiceType } from '../interface';
import APIS, { ActionType } from './apis';
import {
  Secret,
  ApigwCreateOrUpdateServiceInputs,
  ApigwSetupUsagePlanInputs,
  ApigwSetupUsagePlanSecretInputs,
  ApigwBindUsagePlanInputs,
  CreateOrUpdateApiInputs,
  ApiDeployerOutputs,
  ApiDeployerInputs,
  ApigwDeployInputs,
  ApiEndpoint,
  ApigwDeployOutputs,
  ApigwBindCustomDomainOutputs,
  ApigwRemoveOrUnbindUsagePlanInputs,
  ApigwApiRemoverInputs,
  ApigwRemoveInputs,
  ApigwBindCustomDomainInputs,
  ApigwBindUsagePlanOutputs,
  CustomDomain,
} from './interface';

export default class Apigw {
  credentials: CapiCredentials;
  capi: Capi;
  trigger: ApigwTrigger;

  region: RegionType;

  constructor(credentials: CapiCredentials, region: RegionType = 'ap-guangzhou') {
    this.credentials = credentials;
    this.region = region;
    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.apigateway,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });
    this.trigger = new ApigwTrigger({ credentials, region: this.region });
  }

  getProtocolString(protocols: ('http' | 'https')[]) {
    if (!protocols || protocols.length < 1) {
      return 'http';
    }
    const tempProtocol = protocols.join('&').toLowerCase();
    return (tempProtocol === 'https&http' ? 'http&https' : tempProtocol) ?? 'http&https';
  }

  private async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, camelCaseProperty(data));
    return result as never;
  }

  private async removeOrUnbindRequest({
    Action,
    ...data
  }: {
    Action: ActionType;
    [key: string]: any;
  }) {
    try {
      await APIS[Action](this.capi, camelCaseProperty(data));
    } catch (e) {
      // no op
    }
    return true;
  }

  private marshalServiceConfig(endpoint: any, apiInputs: any) {
    if (
      !endpoint.serviceConfig ||
      !endpoint.serviceConfig.url ||
      !endpoint.serviceConfig.path ||
      !endpoint.serviceConfig.method
    ) {
      throw new ApiTypeError(
        `PARAMETER_APIGW`,
        '"endpoints.serviceConfig.url&path&method" is required',
      );
    }
    apiInputs.serviceConfig = {
      url: endpoint.serviceConfig.url,
      path: endpoint.serviceConfig.path,
      method: endpoint.serviceConfig.method.toUpperCase(),
    };
  }

  private marshalApiInput(endpoint: any, apiInputs: any) {
    if (endpoint.param) {
      apiInputs.requestParameters = endpoint.param;
    }

    const { serviceType } = apiInputs;
    // handle front-end API type of WEBSOCKET/HTTP
    if (endpoint.protocol === 'WEBSOCKET') {
      // handle WEBSOCKET API service type of WEBSOCKET/SCF
      if (serviceType === 'WEBSOCKET') {
        this.marshalServiceConfig(endpoint, apiInputs);
      } else {
        const funcNamespace = endpoint.function.functionNamespace || 'default';
        const funcQualifier = endpoint.function.functionQualifier
          ? endpoint.function.functionQualifier
          : '$LATEST';
        if (!endpoint.function.transportFunctionName) {
          throw new ApiTypeError(
            `PARAMETER_APIGW`,
            '"endpoints.function.transportFunctionName" is required',
          );
        }
        apiInputs.serviceWebsocketTransportFunctionName = endpoint.function.transportFunctionName;
        apiInputs.serviceWebsocketTransportFunctionQualifier = funcQualifier;
        apiInputs.serviceWebsocketTransportFunctionNamespace = funcNamespace;

        apiInputs.serviceWebsocketRegisterFunctionName = endpoint.function.registerFunctionName;
        apiInputs.serviceWebsocketRegisterFunctionQualifier = funcQualifier;
        apiInputs.serviceWebsocketRegisterFunctionNamespace = funcNamespace;

        apiInputs.serviceWebsocketCleanupFunctionName = endpoint.function.cleanupFunctionName;
        apiInputs.serviceWebsocketCleanupFunctionQualifier = funcQualifier;
        apiInputs.serviceWebsocketCleanupFunctionNamespace = funcNamespace;
      }
    } else {
      // hande HTTP API service type of SCF/HTTP/MOCK
      switch (serviceType) {
        case 'SCF':
          endpoint.function = endpoint.function || {};
          if (!endpoint.function.functionName) {
            throw new ApiTypeError(
              `PARAMETER_APIGW`,
              '"endpoints.function.functionName" is required',
            );
          }
          apiInputs.serviceScfFunctionName = endpoint.function.functionName;
          apiInputs.serviceScfFunctionNamespace = endpoint.function.functionNamespace || 'default';
          apiInputs.serviceScfIsIntegratedResponse = endpoint.function.isIntegratedResponse
            ? true
            : false;
          apiInputs.serviceScfFunctionQualifier = endpoint.function.functionQualifier
            ? endpoint.function.functionQualifier
            : '$LATEST';
          break;
        case 'HTTP':
          this.marshalServiceConfig(endpoint, apiInputs);
          if (endpoint.serviceParameters && endpoint.serviceParameters.length > 0) {
            apiInputs.serviceParameters = [];
            for (let i = 0; i < endpoint.serviceParameters.length; i++) {
              const inputParam = endpoint.serviceParameters[i];
              const targetParam = {
                name: inputParam.name,
                position: inputParam.position,
                relevantRequestParameterPosition: inputParam.relevantRequestParameterPosition,
                relevantRequestParameterName: inputParam.relevantRequestParameterName,
                defaultValue: inputParam.defaultValue,
                relevantRequestParameterDesc: inputParam.relevantRequestParameterDesc,
                relevantRequestParameterType: inputParam.relevantRequestParameterType,
              };
              apiInputs.serviceParameters.push(targetParam);
            }
          }
          if (endpoint.serviceConfig.uniqVpcId) {
            apiInputs.serviceConfig.uniqVpcId = endpoint.serviceConfig.uniqVpcId;
            apiInputs.serviceConfig.product = 'clb';
          }
          break;
        case 'MOCK':
          if (!endpoint.serviceMockReturnMessage) {
            throw new ApiTypeError(
              `PARAMETER_APIGW`,
              '"endpoints.serviceMockReturnMessage" is required',
            );
          }
          apiInputs.serviceMockReturnMessage = endpoint.serviceMockReturnMessage;
      }
    }
  }

  /** 设置 API 网关密钥 */
  async setupUsagePlanSecret({ secretName, secretIds, created }: ApigwSetupUsagePlanSecretInputs) {
    const secretIdsOutput = {
      created: !!created,
      secretIds,
    };

    // user not setup secret ids, just auto generate one
    if (!secretIds || secretIds.length === 0) {
      console.log(`Creating a new Secret key.`);
      const { AccessKeyId, AccessKeySecret } = await this.request({
        Action: 'CreateApiKey',
        SecretName: secretName,
        AccessKeyType: 'auto',
      });
      console.log(`Secret id ${AccessKeyId} and key ${AccessKeySecret} created`);
      secretIdsOutput.secretIds = [AccessKeyId];
      secretIdsOutput.created = true;
    } else {
      // use setup secret ids
      // 1. unique it
      // 2. make sure all bind secret ids exist in user's list
      const uniqSecretIds = uniqueArray(secretIds);

      // get all secretId, check local secretId exists
      const { ApiKeySet } = (await this.request({
        Action: 'DescribeApiKeysStatus',
        Limit: uniqSecretIds.length,
        Filters: [
          {
            Name: 'AccessKeyId',
            Values: uniqSecretIds,
          },
        ],
      })) as {
        ApiKeySet: { AccessKeyId: string; Status: string }[];
      };

      const existKeysLen = ApiKeySet.length;

      // Filter invalid and non-existent keys
      const ids: string[] = [];
      uniqSecretIds.forEach((secretId: string) => {
        let found = false;
        let disable = false;
        for (let n = 0; n < existKeysLen; n++) {
          if (ApiKeySet[n] && secretId === ApiKeySet[n].AccessKeyId) {
            if (Number(ApiKeySet[n].Status) === 1) {
              found = true;
            } else {
              disable = true;
              console.log(`There is a disabled secret id ${secretId}, cannot be bound`);
            }
            break;
          }
        }
        if (!found) {
          if (!disable) {
            console.log(`Secret id ${secretId} doesn't exist`);
          }
        } else {
          ids.push(secretId);
        }
      });
      secretIdsOutput.secretIds = ids;
    }

    return secretIdsOutput;
  }

  /** 设置 API 网关的使用计划 */
  async setupUsagePlan({
    usagePlan,
  }: {
    usagePlan: ApigwSetupUsagePlanInputs;
  }): Promise<ApigwSetupUsagePlanInputs> {
    const usageInputs = {
      usagePlanName: usagePlan.usagePlanName ?? '',
      usagePlanDesc: usagePlan.usagePlanDesc ?? '',
      maxRequestNumPreSec: usagePlan.maxRequestNumPreSec ?? -1,
      maxRequestNum: usagePlan.maxRequestNum ?? -1,
    };

    const usagePlanOutput = {
      created: usagePlan.created || false,
      usagePlanId: usagePlan.usagePlanId,
    };

    let exist = false;
    if (usagePlan.usagePlanId) {
      try {
        const detail = (await this.request({
          Action: 'DescribeUsagePlan',
          UsagePlanId: usagePlan.usagePlanId,
        })) as {
          UsagePlanId: string;
        };
        if (detail && detail.UsagePlanId) {
          exist = true;
        }
      } catch (e) {
        // no op
      }
    }

    if (exist) {
      console.log(`Updating usage plan ${usagePlan.usagePlanId}.`);
      await this.request({
        Action: 'ModifyUsagePlan',
        usagePlanId: usagePlanOutput.usagePlanId,
        ...usageInputs,
      });
    } else {
      const { UsagePlanId } = await this.request({
        Action: 'CreateUsagePlan',
        ...usageInputs,
      });

      usagePlanOutput.usagePlanId = UsagePlanId;
      usagePlanOutput.created = true;
      console.log(`Usage plan ${usagePlanOutput.usagePlanId} created.`);
    }

    return usagePlanOutput;
  }

  /** 获取 secrets 列表 */
  async getAllBoundSecrets(
    usagePlanId: string,
    res: Secret[] = [],
    { limit, offset = 0 }: { limit: number; offset?: number },
  ): Promise<Secret[]> {
    const { AccessKeyList } = (await this.request({
      Action: 'DescribeUsagePlanSecretIds',
      usagePlanId,
      limit,
      offset,
    })) as {
      AccessKeyList: Secret[];
    };

    if (AccessKeyList.length < limit) {
      return AccessKeyList;
    }
    const more = await this.getAllBoundSecrets(usagePlanId, AccessKeyList, {
      limit,
      offset: offset + AccessKeyList.length,
    });
    // FIXME: more is same type with res, why concat?
    // return res.concat(more.AccessKeyList);
    return res.concat(more);
  }

  /**
   * 找到所有不存在的 secretIds
   */
  async getUnboundSecretIds({
    usagePlanId,
    secretIds,
  }: {
    usagePlanId: string;
    secretIds: string[];
  }) {
    const allBoundSecretObjs = await this.getAllBoundSecrets(usagePlanId, [], { limit: 100 });
    const allBoundSecretIds = allBoundSecretObjs.map((item) => item.AccessKeyId);

    const unboundSecretIds = secretIds.filter((item) => {
      if (allBoundSecretIds.indexOf(item) === -1) {
        return true;
      }
      console.log(`Usage plan ${usagePlanId} secret id ${item} already bound`);
      return false;
    });
    return unboundSecretIds;
  }

  /**
   * 解绑 API 网关所有自定义域名
   * @param serviceId API 网关 ID
   */
  async unbindCustomDomain(serviceId: string, customDomains: CustomDomain[]) {
    const customDomainDetail = (await this.request({
      Action: 'DescribeServiceSubDomains',
      serviceId,
    })) as
      | {
          DomainSet?: { DomainName: string }[];
        }
      | undefined;

    if ((customDomainDetail?.DomainSet?.length ?? 0) > 0) {
      const { DomainSet = [] } = customDomainDetail!;
      // unbind all created domain
      const stateDomains = customDomains || [];
      for (let i = 0; i < DomainSet.length; i++) {
        const domainItem = DomainSet[i];
        for (let j = 0; j < stateDomains.length; j++) {
          // only list subDomain and created in state
          if (stateDomains[j].subDomain === domainItem.DomainName) {
            console.log(`Start unbind domain ${domainItem.DomainName} for service ${serviceId}`);
            await this.request({
              Action: 'UnBindSubDomain',
              serviceId,
              subDomain: domainItem.DomainName,
            });
          }
        }
      }
    }
  }

  /**
   * 为 API 网关服务绑定自定义域名
   */
  async bindCustomDomain({
    serviceId,
    subDomain,
    inputs,
  }: {
    serviceId: string;
    subDomain: string;
    inputs: ApigwBindCustomDomainInputs;
  }): Promise<ApigwBindCustomDomainOutputs[]> {
    const { customDomains, oldState = {} } = inputs;
    if (!customDomains) return [];

    // 1. unbind all custom domain
    this.unbindCustomDomain(serviceId, oldState?.customDomains ?? []);

    // 2. bind user config domain
    const customDomainOutput = [];
    if (customDomains && customDomains.length > 0) {
      console.log(`Start bind custom domain for service ${serviceId}`);
      for (let i = 0; i < customDomains.length; i++) {
        const domainItem = customDomains[i];
        const domainProtocol = domainItem.protocols
          ? this.getProtocolString(domainItem.protocols)
          : inputs.protocols;
        const domainInputs = {
          serviceId,
          subDomain: domainItem.domain,
          netSubDomain: subDomain,
          certificateId: domainItem.certificateId,
          // default isDefaultMapping is true
          isDefaultMapping: domainItem.isDefaultMapping === false ? false : true,
          // if isDefaultMapping is false, should append pathMappingSet config
          pathMappingSet: domainItem.pathMappingSet || [],
          netType: domainItem.netType ? domainItem.netType : 'OUTER',
          protocol: domainProtocol,
          isForcedHttps: domainItem.isForcedHttps === true,
        };

    console.log(`Start bind custom domain for service ${serviceId}`);
    for (let domainItem of customDomains) {
      const domainProtocol = domainItem.protocols
        ? this.getProtocolString(domainItem.protocols)
        : inputs.protocols;

      const domainInputs = {
        serviceId,
        subDomain: domainItem.domain,
        netSubDomain: subDomain,
        certificateId: domainItem.certificateId,
        // default isDefaultMapping is true
        isDefaultMapping: domainItem.isDefaultMapping === false ? false : true,
        // if isDefaultMapping is false, should append pathMappingSet config
        pathMappingSet: domainItem.pathMappingSet || [],
        netType: domainItem.netType ?? 'OUTER',
        protocol: domainProtocol,
      };

      try {
        await this.request({
          Action: 'BindSubDomain',
          ...domainInputs,
        });

        customDomainOutput.push({
          isBinded: true,
          created: true,
          subDomain: domainItem.domain,
          cname: subDomain,
          url: `${domainProtocol.indexOf('https') !== -1 ? 'https' : 'http'}://${
            domainItem.domain
          }`,
        });
        console.log(`Custom domain for service ${serviceId} created successfullly.`);
        console.log(`Please add CNAME record ${subDomain} for ${domainItem.domain}.`);
      } catch (e) {
        // User hasn't add cname dns record
        if (e.code === 'FailedOperation.DomainResolveError') {
          customDomainOutput.push({
            isBinded: false,
            subDomain: domainItem.domain,
            cname: subDomain,
            message: `您的自定义域名还未生效，请给域名 ${domainItem.domain} 添加 CNAME 记录 ${subDomain}，等待解析生效后，再次运行 'sls deploy' 完成自定义域名的配置`,
          });
        } else {
          throw e;
        }
      }
    }

    return customDomainOutput;
  }

  /** API 网关绑定用量计划 */
  async bindUsagePlan({
    apiId,
    serviceId,
    environment,
    usagePlanConfig,
    authConfig,
  }: ApigwBindUsagePlanOutputs) {
    const usagePlan = await this.setupUsagePlan({
      usagePlan: usagePlanConfig,
    });

    if (authConfig) {
      const { secretIds = [] } = authConfig;
      const secrets = await this.setupUsagePlanSecret({
        secretName: authConfig.secretName,
        secretIds,
      });

      const unboundSecretIds = await this.getUnboundSecretIds({
        usagePlanId: usagePlan.usagePlanId,
        secretIds: secrets.secretIds,
      });

      if (unboundSecretIds.length > 0) {
        console.log(
          `Binding secret key ${unboundSecretIds} to usage plan ${usagePlan.usagePlanId}.`,
        );
        await this.request({
          Action: 'BindSecretIds',
          usagePlanId: usagePlan.usagePlanId,
          accessKeyIds: unboundSecretIds,
        });
        console.log('Binding secret key successed.');
      }
      // store in api list
      usagePlan.secrets = secrets;
    }

    const { ApiUsagePlanList } = (await this.request({
      Action: 'DescribeApiUsagePlan',
      serviceId,
      limit: 100,
    })) as { ApiUsagePlanList: { UsagePlanId: string; ApiId: string }[] };

    const oldUsagePlan = ApiUsagePlanList.find((item) => {
      return apiId
        ? item.UsagePlanId === usagePlan.usagePlanId && item.ApiId === apiId
        : item.UsagePlanId === usagePlan.usagePlanId;
    });

    if (oldUsagePlan) {
      if (apiId) {
        console.log(`Usage plan ${usagePlan.usagePlanId} already bind to api ${apiId}`);
      } else {
        console.log(
          `Usage plan ${usagePlan.usagePlanId} already bind to enviromment ${environment}`,
        );
      }

      return usagePlan;
    }

    if (apiId) {
      console.log(`Binding usage plan ${usagePlan.usagePlanId} to api ${apiId}`);
      await this.request({
        Action: 'BindEnvironment',
        serviceId,
        environment,
        bindType: 'API',
        usagePlanIds: [usagePlan.usagePlanId],
        apiIds: [apiId],
      });
      console.log(`Bind usage plan ${usagePlan.usagePlanId} to api ${apiId} success`);
      return usagePlan;
    }

    console.log(`Binding usage plan ${usagePlan.usagePlanId} to enviromment ${environment}`);
    await this.request({
      Action: 'BindEnvironment',
      serviceId,
      environment,
      bindType: 'SERVICE',
      usagePlanIds: [usagePlan.usagePlanId],
    });
    console.log(`Bind usage plan ${usagePlan.usagePlanId} to enviromment ${environment} success`);

    return usagePlan;
  }

  /** 创建或更新 API 网关服务 */
  async createOrUpdateService(serviceConf: ApigwCreateOrUpdateServiceInputs) {
    const {
      environment,
      serviceId,
      protocols,
      netTypes,
      serviceName = 'Serverless_Framework',
      serviceDesc = 'Created By Serverless Framework',
    } = serviceConf;
    let serviceCreated = false;
    let exist = false;

    interface Detail {
      InnerSubDomain: string;
      InternalSubDomain: string;
      OuterSubDomain: string;

      ServiceId: string;

      // FIXME: 小写？
      serviceName: string;
      serviceDesc: string;
      protocol: string;
    }
    let detail: Detail;

    if (serviceId) {
      detail = await this.request({
        Action: 'DescribeService',
        ServiceId: serviceId,
      });
      if (detail) {
        detail.InnerSubDomain = detail.InternalSubDomain;
        exist = true;
        if (
          !(
            // FIXME: 小写？
            (
              serviceName === detail.serviceName &&
              serviceDesc === detail.serviceDesc &&
              protocols === detail.protocol
            )
          )
        ) {
          const apiInputs = {
            Action: 'ModifyService' as const,
            serviceId,
            serviceDesc: serviceDesc || detail.serviceDesc,
            serviceName: serviceName || detail.serviceName,
            protocol: protocols,
            netTypes: netTypes,
          };
          await this.request(apiInputs);
        }
      }
    }

    if (!exist) {
      const apiInputs = {
        Action: 'CreateService' as const,
        serviceName: serviceName || 'Serverless_Framework',
        serviceDesc: serviceDesc || 'Created By Serverless Framework',
        protocol: protocols,
        netTypes,
      };

      detail = await this.request(apiInputs);
      serviceCreated = true;
    }

    const outputs = {
      serviceName,
      serviceId: detail!.ServiceId,
      subDomain:
        detail!.OuterSubDomain && detail!.InnerSubDomain
          ? [detail!.OuterSubDomain, detail!.InnerSubDomain]
          : detail!.OuterSubDomain || detail!.InnerSubDomain,
      serviceCreated,
      usagePlan: undefined as undefined | ApigwSetupUsagePlanInputs,
    };

    if (serviceConf.usagePlan) {
      outputs.usagePlan = await this.bindUsagePlan({
        serviceId: detail!.ServiceId,
        environment,
        usagePlanConfig: serviceConf.usagePlan,
        authConfig: serviceConf.auth,
      });
    }

    return outputs;
  }

  /** 根据路径和方法获取 API 网关接口 */
  async getApiByPathAndMethod({
    serviceId,
    path,
    method,
  }: {
    serviceId: string;
    path: string;
    method: string;
  }) {
    const { ApiIdStatusSet } = (await this.request({
      Action: 'DescribeApisStatus',
      ServiceId: serviceId,
      Filters: [{ Name: 'ApiType', Values: ['normal'] }],
    })) as {
      ApiIdStatusSet: { Method: string; Path: string; ApiId: string; InternalDomain: string }[];
    };

    let apiDetail: {
      Method: string;
      Path: string;
      ApiId: string;
      InternalDomain: string;
    } | null = null;

    if (ApiIdStatusSet) {
      ApiIdStatusSet.forEach((item) => {
        if (item.Path === path && item.Method.toLowerCase() === method.toLowerCase()) {
          apiDetail = item;
        }
      });
    }

    if (apiDetail!) {
      apiDetail = await this.request({
        Action: 'DescribeApi',
        serviceId: serviceId,
        apiId: apiDetail!.ApiId,
      });
    }
    return apiDetail!;
  }

  async getApiById({ serviceId, apiId }) {
    const apiDetail = await this.request({
      Action: 'DescribeApi',
      serviceId: serviceId,
      apiId: apiId,
    });
    return apiDetail;
  }

  async createOrUpdateApi({ serviceId, endpoint, environment, created }: CreateOrUpdateApiInputs) {
    // compatibility for secret auth config depends on auth & usagePlan
    const authType = endpoint.auth ? 'SECRET' : endpoint.authType || 'NONE';
    const businessType = endpoint.businessType || 'NORMAL';
    const output: ApiDeployerOutputs = {
      path: endpoint.path,
      method: endpoint.method,
      apiName: endpoint.apiName || 'index',
      created: true,
      authType: authType,
      businessType: businessType,
      isBase64Encoded: endpoint.isBase64Encoded === true,
      authRelationApiId: endpoint.authRelationApiId,
    };

    const apiInputs = {
      protocol: endpoint.protocol || 'HTTP',
      serviceId: serviceId,
      apiName: endpoint.apiName || 'index',
      apiDesc: endpoint.description,
      apiType: 'NORMAL',
      authType: authType,
      apiBusinessType: endpoint.businessType || 'NORMAL',
      serviceType: endpoint.serviceType || 'SCF',
      requestConfig: {
        path: endpoint.path,
        method: endpoint.method,
      },
      serviceTimeout: endpoint.serviceTimeout || 15,
      responseType: endpoint.responseType || 'HTML',
      enableCORS: endpoint.enableCORS === true,
      isBase64Encoded: endpoint.isBase64Encoded === true,
      oauthConfig: endpoint.oauthConfig,
      authRelationApiId: endpoint.authRelationApiId
    };

    this.marshalApiInput(endpoint, apiInputs);

    let apiDetail = null;
    if (endpoint.apiId) {
      apiDetail = await this.getApiById({ serviceId, apiId: endpoint.apiId });
    }

    if (!apiDetail) {
      apiDetail = await this.getApiByPathAndMethod({
        serviceId,
        path: endpoint.path,
        method: endpoint.method,
      });
    }

    if (apiDetail) {
      console.log(`Api method ${endpoint.method}, path ${endpoint.path} already exist`);
      endpoint.apiId = apiDetail.ApiId;

      if (endpoint.isBase64Encoded && endpoint.isBase64Trigger) {
        apiInputs.isBase64Trigger = endpoint.isBase64Trigger;
        apiInputs.base64EncodedTriggerRules = endpoint.base64EncodedTriggerRules;
      }

      await this.request({
        Action: 'ModifyApi',
        apiId: endpoint.apiId,
        ...apiInputs,
      });

      output.apiId = endpoint.apiId;
      output.created = !!created;
      output.internalDomain = apiDetail.InternalDomain || '';
      console.log(`Api ${output.apiId} updated`);
    } else {
      const { ApiId } = await this.request({
        Action: 'CreateApi',
        ...apiInputs,
      });
      output.apiId = ApiId;
      output.created = true;

      console.log(`API ${ApiId} created.`);
      apiDetail = await this.request({
        Action: 'DescribeApi',
        serviceId: serviceId,
        apiId: output.apiId,
      });
      output.internalDomain = apiDetail.InternalDomain || '';

      if (endpoint.isBase64Encoded && endpoint.isBase64Trigger) {
        apiInputs.isBase64Trigger = endpoint.isBase64Trigger;
        apiInputs.base64EncodedTriggerRules = endpoint.base64EncodedTriggerRules;
      }

      await this.request({
        Action: 'ModifyApi',
        apiId: ApiId,
        ...apiInputs,
      });
    }

    output.apiName = apiInputs.apiName;

    if (endpoint.usagePlan) {
      const usagePlan = await this.bindUsagePlan({
        apiId: output.apiId,
        serviceId,
        environment,
        usagePlanConfig: endpoint.usagePlan,
        authConfig: endpoint.auth,
      });

      output.usagePlan = usagePlan;
    }

    return output;
  }

  /** 部署 API 列表 */
  async apiDeployer({
    serviceId,
    environment,
    apiList = [],
    oldList,
    apiConfig,
    isOauthApi,
  }: ApiDeployerInputs): Promise<ApiDeployerOutputs> {
    // if exist in state list, set created to be true
    const [exist] = oldList.filter(
      (item) =>
        item.method.toLowerCase() === apiConfig.method.toLowerCase() &&
        item.path === apiConfig.path,
    );

    if (exist) {
      apiConfig.apiId = exist.apiId;
      apiConfig.created = exist.created;

      if (isOauthApi) {
        apiConfig.authRelationApiId = exist.authRelationApiId;
      }
    }
    if (isOauthApi && !apiConfig.authRelationApiId) {
      // find reletive oauth api
      const { authRelationApi } = apiConfig;
      if (authRelationApi) {
        const [relativeApi] = apiList.filter(
          (item) =>
            item.method.toLowerCase() === authRelationApi.method.toLowerCase() &&
            item.path === authRelationApi.path,
        );
        if (relativeApi) {
          apiConfig.authRelationApiId = relativeApi.apiId;
        }
      }
    }

    const curApi = await this.createOrUpdateApi({
      serviceId,
      environment,
      endpoint: apiConfig,
      created: exist && exist.created,
    });

    console.log(`Deploy api ${curApi.apiName} success`);
    return curApi;
  }

  /** 部署 API 网关 */
  async deploy(inputs: ApigwDeployInputs) {
    const { environment = 'release' as const, oldState = {} } = inputs;
    inputs.protocols = this.getProtocolString(inputs.protocols as ('http' | 'https')[]);

    const {
      serviceId,
      serviceName,
      subDomain,
      serviceCreated,
      usagePlan,
    } = await this.createOrUpdateService(inputs)!;

    const apiList: ApiEndpoint[] = [];
    const stateApiList = oldState.apiList || [];

    const endpoints = inputs.endpoints || [];

    const businessOauthApis = [];
    // deploy normal api
    for (let i = 0, len = endpoints.length; i < len; i++) {
      const endpoint = endpoints[i];
      if (endpoint.authType === 'OAUTH' && endpoint.businessType === 'NORMAL') {
        businessOauthApis.push(endpoint);
        continue;
      }
      const curApi: ApiDeployerOutputs = await this.apiDeployer({
        serviceId,
        environment,
        apiList,
        oldList: stateApiList,
        apiConfig: endpoint,
      });
      apiList.push(curApi);
    }

    // deploy oauth bisiness apis
    for (let i = 0, len = businessOauthApis.length; i < len; i++) {
      const endpoint = businessOauthApis[i];
      const curApi = await this.apiDeployer({
        serviceId,
        environment,
        apiList,
        oldList: stateApiList,
        apiConfig: endpoint,
        isOauthApi: true,
      });
      apiList.push(curApi);
    }

    console.log(`Releaseing service ${serviceId}, environment ${environment}`);
    await this.request({
      Action: 'ReleaseService',
      serviceId: serviceId,
      environmentName: environment,
      releaseDesc: 'Released by Serverless Component',
    });
    console.log(`Deploy service ${serviceId} success`);

    const outputs: ApigwDeployOutputs = {
      created: serviceCreated || oldState.created,
      serviceId,
      serviceName,
      subDomain,
      protocols: inputs.protocols,
      environment: environment,
      apiList,
    };

    // bind custom domain
    const customDomains = await this.bindCustomDomain({
      serviceId,
      subDomain: isArray(subDomain) ? subDomain[0] : subDomain,
      inputs,
    });
    if (customDomains.length > 0) {
      outputs.customDomains = customDomains;
    }

    if (usagePlan) {
      outputs.usagePlan = usagePlan;
    }

    return outputs;
  }

  /** 移除 API 网关的使用计划 */
  async removeOrUnbindUsagePlan({
    serviceId,
    environment,
    usagePlan,
    apiId,
  }: ApigwRemoveOrUnbindUsagePlanInputs) {
    // 1.1 unbind secrete ids
    const { secrets } = usagePlan;

    if (secrets && secrets.secretIds) {
      await this.removeOrUnbindRequest({
        Action: 'UnBindSecretIds' as const,
        accessKeyIds: secrets.secretIds,
        usagePlanId: usagePlan.usagePlanId,
      });
      console.log(`Unbinding secret key from usage plan ${usagePlan.usagePlanId}.`);

      // delelet all created api key
      if (usagePlan.secrets?.created === true) {
        for (let sIdx = 0; sIdx < secrets.secretIds.length; sIdx++) {
          const secretId = secrets.secretIds[sIdx];
          console.log(`Removing secret key ${secretId}`);
          await this.removeOrUnbindRequest({
            Action: 'DisableApiKey',
            accessKeyId: secretId,
          });
          await this.removeOrUnbindRequest({
            Action: 'DeleteApiKey',
            accessKeyId: secretId,
          });
        }
      }
    }

    // 1.2 unbind environment
    if (apiId) {
      await this.removeOrUnbindRequest({
        Action: 'UnBindEnvironment',
        serviceId,
        usagePlanIds: [usagePlan.usagePlanId],
        environment,
        bindType: 'API',
        apiIds: [apiId],
      });
    } else {
      await this.removeOrUnbindRequest({
        Action: 'UnBindEnvironment',
        serviceId,
        usagePlanIds: [usagePlan.usagePlanId],
        environment,
        bindType: 'SERVICE',
      });
    }

    console.log(`Unbinding usage plan ${usagePlan.usagePlanId} from service ${serviceId}.`);

    // 1.3 delete created usage plan
    if (usagePlan.created === true) {
      console.log(`Removing usage plan ${usagePlan.usagePlanId}`);
      await this.removeOrUnbindRequest({
        Action: 'DeleteUsagePlan',
        usagePlanId: usagePlan.usagePlanId,
      });
    }
  }

  async apiRemover({ apiConfig, serviceId, environment }: ApigwApiRemoverInputs) {
    // 1. remove usage plan
    if (apiConfig.usagePlan) {
      await this.removeOrUnbindUsagePlan({
        serviceId,
        environment,
        apiId: apiConfig.apiId,
        usagePlan: apiConfig.usagePlan,
      });
    }

    // 2. delete only apis created by serverless framework
    if (apiConfig.apiId && apiConfig.created === true) {
      console.log(`Removing api ${apiConfig.apiId}`);
      await this.trigger.remove({
        serviceId,
        apiId: apiConfig.apiId,
      });
      await this.removeOrUnbindRequest({
        Action: 'DeleteApi',
        apiId: apiConfig.apiId,
        serviceId,
      });
    }
  }

  async remove(inputs: ApigwRemoveInputs) {
    const { created, environment, serviceId, apiList, customDomains, usagePlan } = inputs;

    // check service exist
    const detail = await this.request({
      Action: 'DescribeService',
      ServiceId: serviceId,
    });

    if (!detail) {
      console.log(`Service ${serviceId} not exist`);
      return;
    }

    // remove usage plan
    if (usagePlan) {
      await this.removeOrUnbindUsagePlan({
        serviceId,
        environment,
        usagePlan,
      });
    }

    // 1. remove all apis
    const oauthApis = [];
    for (let i = 0; i < apiList.length; i++) {
      const curApi = apiList[i];
      if (curApi.authType === 'OAUTH' && curApi.businessType === 'OAUTH') {
        oauthApis.push(curApi);
        continue;
      }

      await this.apiRemover({
        apiConfig: curApi,
        serviceId,
        environment,
      });
    }
    for (let i = 0; i < oauthApis.length; i++) {
      const curApi = oauthApis[i];
      await this.apiRemover({
        apiConfig: curApi,
        serviceId,
        environment,
      });
    }

    // 2. unbind all custom domains
    if (customDomains) {
      for (let i = 0; i < customDomains.length; i++) {
        const curDomain = customDomains[i];
        if (curDomain.subDomain && curDomain.created === true) {
          console.log(`Unbinding custom domain ${curDomain.subDomain}`);
          await this.removeOrUnbindRequest({
            Action: 'UnBindSubDomain',
            serviceId,
            subDomain: curDomain.subDomain,
          });
        }
      }
    }

    if (created === true) {
      // unrelease service
      console.log(`Unreleasing service: ${serviceId}, environment ${environment}`);
      await this.removeOrUnbindRequest({
        Action: 'UnReleaseService',
        serviceId,
        environmentName: environment,
      });
      console.log(`Unrelease service ${serviceId}, environment ${environment} success`);

      // delete service
      console.log(`Removing service ${serviceId}`);
      await this.removeOrUnbindRequest({
        Action: 'DeleteService',
        serviceId,
      });
      console.log(`Remove service ${serviceId} success`);
    }
  }
}

module.exports = Apigw;
