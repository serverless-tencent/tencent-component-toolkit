import { Capi } from '@tencent-sdk/capi';
import {
  UpdateApiInputs,
  ApiDeployInputs,
  ApiDeployOutputs,
  CreateApiInputs,
  ApiRemoveInputs,
  ApiBulkRemoveInputs,
  ApiBulkDeployInputs,
  ApiDetail,
  EnviromentType,
} from '../interface';
import { pascalCaseProps } from '../../../utils';
import { ApiTypeError } from '../../../utils/error';
import APIS, { ActionType } from '../apis';
import UsagePlanEntity from './usage-plan';
import ApplicationEntity from './application';
import { ApigwTrigger } from '../../triggers';

export default class ApiEntity {
  capi: Capi;
  usagePlan: UsagePlanEntity;
  trigger: ApigwTrigger;
  app: ApplicationEntity;

  constructor(capi: Capi, trigger: ApigwTrigger) {
    this.capi = capi;
    this.trigger = trigger;

    this.usagePlan = new UsagePlanEntity(capi);
    this.app = new ApplicationEntity(capi);
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, pascalCaseProps(data));
    return result as any;
  }

  async removeRequest({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    try {
      await APIS[Action](this.capi, pascalCaseProps(data));
    } catch (e) {
      console.warn(e);
    }
    return true;
  }

  async create({ serviceId, endpoint, environment }: CreateApiInputs) {
    console.log(`Api method ${endpoint?.method}, path ${endpoint?.path} creating`);
    // compatibility for secret auth config depends on auth & usagePlan
    const authType = endpoint?.auth ? 'SECRET' : endpoint?.authType ?? 'NONE';
    const businessType = endpoint?.businessType ?? 'NORMAL';
    const output: ApiDeployOutputs = {
      path: endpoint?.path,
      method: endpoint?.method,
      apiName: endpoint?.apiName || 'index',
      created: true,
      authType: authType,
      businessType: businessType,
      isBase64Encoded: endpoint?.isBase64Encoded === true,
    };
    if (endpoint?.authRelationApiId) {
      output.authRelationApiId = endpoint.authRelationApiId;
    }

    const apiInputs = this.formatInput({ endpoint, serviceId });

    const res = await this.request({
      Action: 'CreateApi',
      ...apiInputs,
    });
    const { ApiId } = res;
    output.apiId = ApiId;

    console.log(`API ${ApiId} created`);
    // const apiDetail: ApiDetail = await this.request({
    //   Action: 'DescribeApi',
    //   serviceId: serviceId,
    //   apiId: output.apiId,
    // });
    // output.internalDomain = apiDetail.InternalDomain || '';

    if (endpoint?.isBase64Encoded && endpoint.isBase64Trigger) {
      apiInputs.isBase64Trigger = endpoint.isBase64Trigger;
      apiInputs.base64EncodedTriggerRules = endpoint.base64EncodedTriggerRules;
    }

    await this.request({
      Action: 'ModifyApi',
      apiId: ApiId,
      ...apiInputs,
    });

    output.apiName = apiInputs.apiName;

    // 以下为密钥对鉴权方式
    if (endpoint?.usagePlan) {
      const usagePlan = await this.usagePlan.bind({
        apiId: output.apiId,
        serviceId,
        environment,
        usagePlanConfig: endpoint.usagePlan,
        authConfig: endpoint.auth,
      });

      output.usagePlan = usagePlan;
    }

    // 网关应用鉴权方式
    if (endpoint.app) {
      const app = await this.app.bind({
        serviceId,
        environment,
        apiId: output.apiId!,
        appConfig: endpoint.app,
      });

      output.app = app;
    }

    return output;
  }

  // 解绑网关应用
  async unbindApiApp({
    serviceId,
    apiId,
    environment,
  }: {
    serviceId: string;
    apiId: string;
    environment: EnviromentType;
  }) {
    const apiAppRes: {
      ApiAppApiSet: {
        ApiAppId: string;
        ApiAppName: string;
        ApiId: string;
        ServiceId: string;
        ApiRegion: string;
        EnvironmentName: string;
        AuthorizedTime: string;
      }[];
    } = await this.request({
      Action: 'DescribeApiBindApiAppsStatus',
      ServiceId: serviceId,
      ApiIds: [apiId],
    });
    for (const apiApp of apiAppRes.ApiAppApiSet) {
      console.log(`Unbinding api app ${apiApp.ApiAppId}`);
      await this.app.unbind({
        serviceId: apiApp.ServiceId,
        environment,
        apiId: apiApp.ApiId,
        appConfig: {
          name: '',
          id: apiApp.ApiAppId,
        },
      });
    }
  }

  async update(
    { serviceId, endpoint, environment, created }: UpdateApiInputs,
    apiDetail: ApiDetail,
  ) {
    // compatibility for secret auth config depends on auth & usagePlan
    const authType = endpoint?.auth ? 'SECRET' : endpoint?.authType ?? 'NONE';
    const businessType = endpoint?.businessType ?? 'NORMAL';
    const output: ApiDeployOutputs = {
      path: endpoint?.path,
      method: endpoint?.method,
      apiName: endpoint?.apiName || 'index',
      created: false,
      authType: authType,
      businessType: businessType,
      isBase64Encoded: endpoint?.isBase64Encoded === true,
    };
    if (endpoint?.authRelationApiId) {
      output.authRelationApiId = endpoint.authRelationApiId;
    }

    const apiInputs = this.formatInput({ endpoint, serviceId });

    console.log(`Api method ${endpoint?.method}, path ${endpoint?.path} already exist`);
    endpoint.apiId = apiDetail.ApiId;

    if (endpoint.isBase64Encoded && endpoint.isBase64Trigger) {
      apiInputs.isBase64Trigger = endpoint.isBase64Trigger;
      apiInputs.base64EncodedTriggerRules = endpoint.base64EncodedTriggerRules;
    }

    // TODO: 一个奇怪的问题：测试中不解绑 app 直接修改没有问题，但实际中必须先解绑 app
    // await this.unbindApiApp({ serviceId, apiId: endpoint.apiId, environment });

    await this.request({
      Action: 'ModifyApi',
      apiId: endpoint.apiId,
      ...apiInputs,
    });

    output.apiId = endpoint.apiId;
    output.created = !!created;
    // output.internalDomain = apiDetail.InternalDomain || '';
    console.log(`Api ${output.apiId} updated`);

    output.apiName = apiInputs.apiName;

    if (endpoint?.usagePlan) {
      console.log(`Binding api usage plan`);
      const usagePlan = await this.usagePlan.bind({
        apiId: output.apiId,
        serviceId,
        environment,
        usagePlanConfig: endpoint.usagePlan,
        authConfig: endpoint.auth,
      });

      output.usagePlan = usagePlan;
    }

    // 绑定网关应用
    if (endpoint.app) {
      console.log(`Binding api app`);
      const app = await this.app.bind({
        serviceId,
        environment,
        apiId: output.apiId,
        appConfig: endpoint.app,
      });

      output.app = app;
    }

    return output;
  }

  async bulkDeploy({ apiList, stateList, serviceId, environment }: ApiBulkDeployInputs) {
    const deployList: ApiDeployOutputs[] = [];
    const businessOauthApis = [];
    // deploy normal api
    for (let i = 0, len = apiList.length; i < len; i++) {
      const endpoint = apiList[i];
      if (endpoint.authType === 'OAUTH' && endpoint.businessType === 'NORMAL') {
        businessOauthApis.push(endpoint);
        continue;
      }
      const curApi: ApiDeployOutputs = await this.deploy({
        serviceId,
        environment,
        apiList: deployList,
        oldList: stateList,
        apiConfig: endpoint,
      });
      deployList.push(curApi);
    }

    // deploy oauth bisiness apis
    for (let i = 0, len = businessOauthApis.length; i < len; i++) {
      const endpoint = businessOauthApis[i];
      const curApi = await this.deploy({
        serviceId,
        environment,
        apiList: deployList,
        oldList: stateList,
        apiConfig: endpoint,
        isOauthApi: true,
      });
      deployList.push(curApi);
    }

    return deployList;
  }

  /** 部署 API 列表 */
  async deploy({
    serviceId,
    environment,
    apiList = [],
    oldList,
    apiConfig,
    isOauthApi,
  }: ApiDeployInputs): Promise<ApiDeployOutputs> {
    // if exist in state list, set created to be true
    const [exist] = oldList.filter(
      (item) =>
        item?.method?.toLowerCase() === apiConfig?.method?.toLowerCase() &&
        item.path?.toLowerCase() === apiConfig.path?.toLowerCase(),
    );

    if (exist) {
      apiConfig.apiId = exist.apiId;
      apiConfig.created = exist.created;
    }
    if (isOauthApi && !apiConfig.authRelationApiId) {
      // find reletive oauth api
      const { authRelationApi } = apiConfig;
      if (authRelationApi) {
        const [relativeApi] = apiList.filter(
          (item) =>
            item.method?.toLowerCase() === authRelationApi.method.toLowerCase() &&
            item.path?.toLowerCase() === authRelationApi.path.toLowerCase(),
        );
        if (relativeApi) {
          apiConfig.authRelationApiId = relativeApi.apiId;
        } else {
          // get relative api
          const relativeApiDetail = await this.getByPathAndMethod({
            serviceId,
            path: authRelationApi.path,
            method: authRelationApi.method,
          });

          apiConfig.authRelationApiId = relativeApiDetail.ApiId;
        }
      }
    }

    let curApi;
    let apiDetail: ApiDetail | null = null;

    if (apiConfig.apiId) {
      apiDetail = await this.getById({ serviceId: serviceId!, apiId: apiConfig.apiId });
    }

    if (!apiDetail) {
      apiDetail = await this.getByPathAndMethod({
        serviceId: serviceId!,
        path: apiConfig?.path!,
        method: apiConfig?.method!,
      });
    }

    // api 存在就更新，不存在就创建
    if (apiDetail) {
      curApi = await this.update(
        {
          serviceId,
          environment,
          endpoint: apiConfig,
          created: exist && exist.created,
        },
        apiDetail,
      );
    } else {
      curApi = await this.create({
        serviceId,
        environment,
        endpoint: apiConfig,
        created: exist && exist.created,
      });
    }

    console.log(`Deploy api ${curApi.apiName} success`);
    return curApi;
  }

  async remove({ apiConfig: endpoint, serviceId, environment }: ApiRemoveInputs) {
    // 1. unbind and remove usage plan (only remove created usage plan)
    if (endpoint.usagePlan) {
      await this.usagePlan.remove({
        serviceId,
        environment,
        apiId: endpoint.apiId,
        usagePlan: endpoint.usagePlan,
      });
    }

    // 2. unbind app
    if (endpoint.app) {
      await this.app.unbind({
        serviceId,
        environment,
        apiId: endpoint.apiId!,
        appConfig: endpoint.app,
      });
    }

    // 3. delete only apis created by serverless framework
    if (endpoint.apiId && endpoint.created === true) {
      console.log(`Removing api ${endpoint.apiId}`);
      await this.trigger.remove({
        serviceId,
        apiId: endpoint.apiId,
      });

      await this.removeRequest({
        Action: 'DeleteApi',
        apiId: endpoint.apiId,
        serviceId,
      });
    }
  }

  async bulkRemove({ apiList, serviceId, environment }: ApiBulkRemoveInputs) {
    const oauthApis = [];
    for (let i = 0; i < apiList.length; i++) {
      const curApi = apiList[i];
      if (curApi.authType === 'OAUTH' && curApi.businessType === 'OAUTH') {
        oauthApis.push(curApi);
        continue;
      }

      await this.remove({
        apiConfig: curApi,
        serviceId,
        environment,
      });
    }
    for (let i = 0; i < oauthApis.length; i++) {
      const curApi = oauthApis[i];
      await this.remove({
        apiConfig: curApi,
        serviceId,
        environment,
      });
    }
  }

  formatServiceConfig(endpoint: any, apiInputs: any) {
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

  formatInput({ serviceId, endpoint }: Omit<CreateApiInputs, 'environment'>) {
    const authType = endpoint?.auth ? 'SECRET' : endpoint?.authType ?? 'NONE';

    const apiInputs: { [key: string]: any } = {
      // protocol: endpoint?.protocol ?? 'HTTP',
      protocol: endpoint?.protocolType ?? 'HTTP',
      serviceId: serviceId,
      apiName: endpoint?.apiName ?? 'index',
      apiDesc: endpoint?.description,
      apiType: 'NORMAL',
      authType: authType,
      apiBusinessType: endpoint?.businessType ?? 'NORMAL',
      serviceType: endpoint?.serviceType ?? 'SCF',
      requestConfig: {
        path: endpoint?.path,
        method: endpoint?.protocolType === 'WEBSOCKET' ? 'GET' : endpoint?.method,
      },
      serviceTimeout: endpoint?.serviceTimeout ?? 15,
      responseType: endpoint?.responseType ?? 'HTML',
      enableCORS: endpoint?.enableCORS === true,
      isBase64Encoded: endpoint?.isBase64Encoded === true,
      isBase64Trigger: undefined as undefined | boolean,
      base64EncodedTriggerRules: undefined as
        | undefined
        | {
            name: string;
            value: string[];
          }[],
      oauthConfig: endpoint?.oauthConfig,
      authRelationApiId: endpoint?.authRelationApiId,
    };

    if (endpoint?.param) {
      apiInputs.requestParameters = endpoint.param;
    }

    const { serviceType } = apiInputs;
    // handle front-end API type of WEBSOCKET/HTTP
    if (endpoint.protocol === 'WEBSOCKET') {
      // handle WEBSOCKET API service type of WEBSOCKET/SCF
      if (serviceType === 'WEBSOCKET') {
        this.formatServiceConfig(endpoint, apiInputs);
      } else {
        endpoint.function = endpoint.function || {};
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
          apiInputs.serviceScfFunctionType = endpoint.function.functionType;
          apiInputs.serviceScfFunctionNamespace = endpoint.function.functionNamespace || 'default';
          apiInputs.serviceScfIsIntegratedResponse = endpoint.function.isIntegratedResponse
            ? true
            : false;
          apiInputs.serviceScfFunctionQualifier = endpoint.function.functionQualifier
            ? endpoint.function.functionQualifier
            : '$LATEST';
          break;
        case 'HTTP':
          this.formatServiceConfig(endpoint, apiInputs);
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
          if (endpoint.serviceConfig?.uniqVpcId) {
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

    return apiInputs;
  }

  async getList(serviceId: string) {
    const { ApiIdStatusSet } = (await this.request({
      Action: 'DescribeApisStatus',
      ServiceId: serviceId,
      Offset: 0,
      Limit: 100,
    })) as {
      ApiIdStatusSet: { Method: string; Path: string; ApiId: string; InternalDomain: string }[];
    };

    return ApiIdStatusSet;
  }

  /** 根据路径和方法获取 API 网关接口 */
  async getByPathAndMethod({
    serviceId,
    path,
    method,
  }: {
    serviceId?: string;
    path: string;
    method: string;
  }) {
    const { ApiIdStatusSet } = (await this.request({
      Action: 'DescribeApisStatus',
      ServiceId: serviceId,
      Offset: 0,
      Limit: 100,
      Filters: [{ Name: 'ApiPath', Values: [path] }],
    })) as {
      ApiIdStatusSet: ApiDetail[];
    };

    let apiDetail: any = null;

    if (ApiIdStatusSet) {
      ApiIdStatusSet.forEach((item) => {
        // 比对 path+method 忽略大小写
        if (
          item.Path.toLowerCase() === path.toLowerCase() &&
          item.Method.toLowerCase() === method.toLowerCase()
        ) {
          apiDetail = item;
        }
      });
    }

    if (apiDetail) {
      apiDetail = (await this.request({
        Action: 'DescribeApi',
        serviceId: serviceId,
        apiId: apiDetail!.ApiId,
      })) as ApiDetail;
    }
    return apiDetail!;
  }

  async getById({ serviceId, apiId }: { serviceId: string; apiId: string }) {
    const apiDetail = await this.request({
      Action: 'DescribeApi',
      serviceId: serviceId,
      apiId: apiId,
    });
    return apiDetail;
  }
}
