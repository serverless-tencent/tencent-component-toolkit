const { Capi } = require('@tencent-sdk/capi');
const Apis = require('./apis');
const { uniqueArray, camelCaseProperty } = require('../../utils/index');

class Apigw {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      AppId: this.credentials.AppId,
      SecretId: this.credentials.SecretId,
      SecretKey: this.credentials.SecretKey,
      Token: this.credentials.Token,
    });
  }

  getProtocolString(protocols) {
    const tempProtocol = protocols.join('&').toLowerCase();
    return tempProtocol === 'https&http'
      ? 'http&https'
      : tempProtocol
      ? tempProtocol
      : 'http&https';
  }

  async request({ Action, ...data }) {
    const result = await Apis[Action](this.capi, camelCaseProperty(data));
    return result;
  }

  async removeOrUnbindRequest({ Action, ...data }) {
    try {
      await Apis[Action](this.capi, camelCaseProperty(data));
    } catch (e) {
      // no op
    }
  }

  async createOrUpdateService(serviceConf) {
    const {
      serviceId,
      protocols,
      netTypes = ['OUTER'],
      serviceName = 'Serverless_Framework',
      serviceDesc = 'Created By Serverless Framework',
    } = serviceConf;
    let serviceCreated = false;
    let detail;
    let exist = false;
    if (serviceId) {
      detail = await this.request({
        Action: 'DescribeService',
        ServiceId: serviceId,
      });
      if (detail) {
        exist = true;
        if (
          !(
            serviceName === detail.serviceName &&
            serviceDesc === detail.serviceDesc &&
            protocols === detail.protocol
          )
        ) {
          await this.request({
            Action: 'ModifyService',
            serviceId,
            serviceDesc: serviceDesc || detail.serviceDesc,
            serviceName: serviceName || detail.serviceName,
            protocol: protocols,
            netTypes: netTypes,
          });
        }
      }
    }
    if (!exist) {
      detail = await this.request({
        Action: 'CreateService',
        serviceName: serviceName || 'Serverless_Framework',
        serviceDesc: serviceDesc || 'Created By Serverless Framework',
        protocol: protocols,
        netTypes: netTypes,
      });
      serviceCreated = true;
    }

    return {
      serviceName,
      serviceId: detail.ServiceId,
      subDomain:
        detail.OuterSubDomain && detail.InnerSubDomain
          ? [detail.OuterSubDomain, detail.InnerSubDomain]
          : detail.OuterSubDomain || detail.InnerSubDomain,
      serviceCreated,
    };
  }

  marshalServiceConfig(endpoint, apiInputs) {
    if (
      !endpoint.serviceConfig ||
      !endpoint.serviceConfig.url ||
      !endpoint.serviceConfig.path ||
      !endpoint.serviceConfig.method
    ) {
      throw new TypeError(
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

  marshalApiInput(endpoint, apiInputs) {
    if (endpoint.param) {
      apiInputs.requestParameters = endpoint.param;
    }

    const { serviceType } = apiInputs;
    endpoint.function = endpoint.function || {};
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
          throw new TypeError(
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
          if (!endpoint.function.functionName) {
            throw new TypeError(`PARAMETER_APIGW`, '"endpoints.function.functionName" is required');
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
            throw new TypeError(
              `PARAMETER_APIGW`,
              '"endpoints.serviceMockReturnMessage" is required',
            );
          }
          apiInputs.serviceMockReturnMessage = endpoint.serviceMockReturnMessage;
      }
    }
  }

  async createOrUpdateApi({ serviceId, endpoint }) {
    const output = {
      path: endpoint.path,
      method: endpoint.method,
      apiName: endpoint.apiName || 'index',
      apiId: undefined,
      created: false,
    };

    const apiInputs = {
      protocol: endpoint.protocol || 'HTTP',
      serviceId: serviceId,
      apiName: endpoint.apiName || 'index',
      apiDesc: endpoint.description,
      apiType: 'NORMAL',
      authType: endpoint.auth ? 'SECRET' : 'NONE',
      // authRequired: endpoint.auth ? 'TRUE' : 'FALSE',
      serviceType: endpoint.serviceType || 'SCF',
      requestConfig: {
        path: endpoint.path,
        method: endpoint.method,
      },
      serviceTimeout: endpoint.serviceTimeout || 15,
      responseType: endpoint.responseType || 'HTML',
      enableCORS: endpoint.enableCORS === true ? true : false,
    };

    let exist = false;
    let apiDetail = null;

    // 没有apiId，还需要根据path来确定
    if (!endpoint.apiId) {
      const pathAPIList = await this.request({
        Action: 'DescribeApisStatus',
        ServiceId: serviceId,
        Filters: [{ Name: 'ApiPath', Values: [endpoint.path] }],
      });
      if (pathAPIList.ApiIdStatusSet) {
        for (let i = 0; i < pathAPIList.ApiIdStatusSet.length; i++) {
          if (
            pathAPIList.ApiIdStatusSet[i].Method.toLowerCase() === endpoint.method.toLowerCase() &&
            pathAPIList.ApiIdStatusSet[i].Path === endpoint.path
          ) {
            endpoint.apiId = pathAPIList.ApiIdStatusSet[i].ApiId;
            exist = true;
          }
        }
      }
    }

    // get API info after apiId confirmed
    if (endpoint.apiId) {
      apiDetail = await this.request({
        Action: 'DescribeApi',
        serviceId: serviceId,
        apiId: endpoint.apiId,
      });

      if (apiDetail && apiDetail.ApiId) {
        exist = true;
      }
    }

    if (!exist) {
      this.marshalApiInput(endpoint, apiInputs);
      const { ApiId } = await this.request({
        Action: 'CreateApi',
        ...apiInputs,
      });

      output.apiId = ApiId;
      output.created = true;

      console.log(`API with id ${output.apiId} created.`);
      apiDetail = await this.request({
        Action: 'DescribeApi',
        serviceId: serviceId,
        apiId: output.apiId,
      });
      output.internalDomain = apiDetail.InternalDomain;
    } else {
      console.log(`Updating api with api id ${endpoint.apiId}.`);
      this.marshalApiInput(endpoint, apiInputs);
      await this.request({
        Action: 'ModifyApi',
        apiId: endpoint.apiId,
        ...apiInputs,
      });
      output.apiId = endpoint.apiId;
      output.internalDomain = apiDetail.InternalDomain;
      console.log(`Service with id ${output.apiId} updated.`);
    }

    output.apiName = apiInputs.apiName;
    return output;
  }

  async setupUsagePlanSecret({ secretName, secretIds }) {
    const secretIdsOutput = {
      created: false,
      secretIds,
    };

    // user not setup secret ids, just auto generate one
    if (secretIds.length === 0) {
      console.log(`Creating a new Secret key.`);
      const { AccessKeyId, AccessKeySecret } = await this.request({
        Action: 'CreateApiKey',
        SecretName: secretName,
        AccessKeyType: 'auto',
      });
      console.log(`Secret key with ID ${AccessKeyId} and key ${AccessKeySecret} updated.`);
      secretIdsOutput.secretIds = [AccessKeyId];
      secretIdsOutput.created = true;
    } else {
      // use setup secret ids
      // 1. unique it
      // 2. make sure all bind secret ids exist in user's list
      const uniqSecretIds = uniqueArray(secretIds);

      // get all secretId, check local secretId exists
      const { ApiKeySet } = await this.request({
        Action: 'DescribeApiKeysStatus',
        Limit: uniqSecretIds.length,
        Filters: [
          {
            Name: 'AccessKeyId',
            Values: uniqSecretIds,
          },
        ],
      });

      const existKeysLen = ApiKeySet.length;

      // Filter invalid and non-existent keys
      const ids = [];
      uniqSecretIds.forEach((secretId) => {
        let found = false;
        let disable = false;
        for (let n = 0; n < existKeysLen; n++) {
          if (ApiKeySet[n] && secretId === ApiKeySet[n].AccessKeyId) {
            if (Number(ApiKeySet[n].Status) === 1) {
              found = true;
            } else {
              disable = true;
              console.log(`There is a disabled secret key: ${secretId}, cannot be bound`);
            }
            break;
          }
        }
        if (!found) {
          if (!disable) {
            console.log(`Secret key id ${secretId} doesn't exist`);
          }
        } else {
          ids.push(secretId);
        }
      });
      secretIdsOutput.secretIds = ids;
    }

    return secretIdsOutput;
  }

  async setupApiUsagePlan({ usagePlan }) {
    const usageInputs = {
      usagePlanName: usagePlan.usagePlanName || '',
      usagePlanDesc: usagePlan.usagePlanDesc || '',
      maxRequestNumPreSec: usagePlan.maxRequestNumPreSec || 1000,
      maxRequestNum: usagePlan.maxRequestNum || -1,
    };

    const usagePlanOutput = {
      created: usagePlan.created || false,
      usagePlanId: usagePlan.usagePlanId,
    };

    let exist = false;
    if (usagePlan.usagePlanId) {
      try {
        const detail = await this.request({
          Action: 'DescribeUsagePlan',
          UsagePlanId: usagePlan.usagePlanId,
        });
        if (detail && detail.UsagePlanId) {
          exist = true;
        }
      } catch (e) {
        // no op
      }
    }

    if (exist) {
      console.log(`Updating usage plan with id ${usagePlan.usagePlanId}.`);
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
      console.log(`Usage plan with ID ${usagePlanOutput.usagePlanId} created.`);
    }

    return usagePlanOutput;
  }

  /**
   * get all unbound secretids
   */
  async getUnboundSecretIds({ usagePlanId, secretIds }) {
    const getAllBoundSecrets = async (res = [], { limit, offset = 0 }) => {
      const { AccessKeyList } = await this.request({
        Action: 'DescribeUsagePlanSecretIds',
        usagePlanId,
        limit,
        offset,
      });

      if (AccessKeyList.length < limit) {
        return AccessKeyList;
      }
      const more = await getAllBoundSecrets(AccessKeyList, {
        limit,
        offset: offset + AccessKeyList.length,
      });
      return res.concat(more.AccessKeyList);
    };
    const allBoundSecretObjs = await getAllBoundSecrets([], { limit: 100 });
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

  // bind custom domains
  async bindCustomDomain({ serviceId, subDomain, inputs }) {
    const { customDomains, oldState = {} } = inputs;
    if (!customDomains) {
      return [];
    }
    // 1. unbind all custom domain
    const customDomainDetail = await this.request({
      Action: 'DescribeServiceSubDomains',
      serviceId,
    });
    if (
      customDomainDetail &&
      customDomainDetail.DomainSet &&
      customDomainDetail.DomainSet.length > 0
    ) {
      const { DomainSet = [] } = customDomainDetail;
      // unbind all created domain
      const stateDomains = oldState.customDomains || [];
      for (let i = 0; i < DomainSet.length; i++) {
        const domainItem = DomainSet[i];
        for (let j = 0; j < stateDomains.length; j++) {
          // only list subDomain and created in state
          if (stateDomains[j].subDomain === domainItem.DomainName) {
            console.log(
              `Start unbind previus domain ${domainItem.DomainName} for service ${serviceId}`,
            );
            await this.request({
              Action: 'UnBindSubDomain',
              serviceId,
              subDomain: domainItem.DomainName,
            });
          }
        }
      }
    }
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
        };
        await this.request({
          Action: 'BindSubDomain',
          ...domainInputs,
        });
        customDomainOutput.push({
          created: true,
          subDomain: domainItem.domain,
          cname: subDomain,
          url: `${domainProtocol.indexOf('https') !== -1 ? 'https' : 'http'}://${
            domainItem.domain
          }`,
        });
        console.log(`Custom domain for service ${serviceId} created successfullly.`);
        console.log(`Please add CNAME record ${subDomain} for ${domainItem.domain}.`);
      }
    }

    return customDomainOutput;
  }

  // bind environment of usage plan
  async bindUsagePlanEnvironment({
    environment,
    bindType = 'API',
    serviceId,
    apiId,
    endpoint,
    usagePlan,
  }) {
    const { ApiUsagePlanList } = await this.request({
      Action: 'DescribeApiUsagePlan',
      serviceId,
      // ApiIds: [apiId],
      limit: 100,
    });

    const oldUsagePlan = ApiUsagePlanList.find(
      (item) => item.UsagePlanId === usagePlan.usagePlanId,
    );

    if (oldUsagePlan) {
      console.log(
        `Usage plan with id ${usagePlan.usagePlanId} already bind to api id ${apiId} path ${endpoint.method} ${endpoint.path}.`,
      );
    } else {
      console.log(
        `Binding usage plan with id ${usagePlan.usagePlanId} to api id ${apiId} path ${endpoint.method} ${endpoint.path}.`,
      );
      await this.request({
        Action: 'BindEnvironment',
        serviceId,
        environment,
        bindType: bindType,
        usagePlanIds: [usagePlan.usagePlanId],
        apiIds: [apiId],
      });
      console.log('Binding successed.');
    }
  }

  async deploy(inputs) {
    const { environment, oldState = {} } = inputs;
    inputs.protocols = this.getProtocolString(inputs.protocols);

    const { serviceId, serviceName, subDomain, serviceCreated } = await this.createOrUpdateService(
      inputs,
    );

    const apiList = [];
    const stateApiList = oldState.apiList || [];

    const endpoints = inputs.endpoints || [];
    for (let i = 0, len = endpoints.length; i < len; i++) {
      const endpoint = endpoints[i];
      // if exist in state list, set created to be true
      const [exist] = stateApiList.filter(
        (item) =>
          item.method.toLowerCase() === endpoint.method.toLowerCase() &&
          item.path === endpoint.path,
      );

      if (exist) {
        endpoint.apiId = exist.apiId;
      }
      const curApi = await this.createOrUpdateApi({
        serviceId,
        endpoint,
      });
      if (exist) {
        curApi.created = true;
      }

      // set api auth and use plan
      if (endpoint.auth) {
        curApi.bindType = endpoint.bindType || 'API';
        const usagePlan = await this.setupApiUsagePlan({
          usagePlan: {
            ...((exist && exist.usagePlan) || {}),
            ...endpoint.usagePlan,
          },
        });

        // store in api list
        curApi.usagePlan = usagePlan;

        const { secretIds = [] } = endpoint.auth;
        const secrets = await this.setupUsagePlanSecret({
          secretName: endpoint.auth.secretName,
          secretIds,
        });

        const unboundSecretIds = await this.getUnboundSecretIds({
          usagePlanId: usagePlan.usagePlanId,
          secretIds: secrets.secretIds,
        });

        if (unboundSecretIds.length > 0) {
          console.log(
            `Binding secret key ${unboundSecretIds} to usage plan with id ${usagePlan.usagePlanId}.`,
          );
          await this.request({
            Action: 'BindSecretIds',
            usagePlanId: usagePlan.usagePlanId,
            accessKeyIds: unboundSecretIds,
          });
          console.log('Binding secret key successed.');
        }
        // store in api list
        curApi.usagePlan.secrets = secrets;

        // bind environment
        await this.bindUsagePlanEnvironment({
          environment,
          serviceId,
          apiId: curApi.apiId,
          bindType: curApi.bindType,
          usagePlan,
          endpoint,
        });
      }

      apiList.push(curApi);
      console.log(
        `Deployment successful for the api named ${curApi.apiName} in the ${this.region} region.`,
      );
    }

    console.log(`Releaseing service with id ${serviceId}, environment: ${inputs.environment}`);
    await this.request({
      Action: 'ReleaseService',
      serviceId: serviceId,
      environmentName: inputs.environment,
      releaseDesc: 'Serverless api-gateway component deploy',
    });
    console.log(`Deploy service with id ${serviceId} successfully.`);

    const outputs = {
      created: serviceCreated,
      serviceId,
      serviceName,
      subDomain,
      protocols: inputs.protocols,
      environment: inputs.environment,
      apiList,
    };

    // bind custom domain
    const customDomains = await this.bindCustomDomain({
      serviceId,
      subDomain,
      inputs,
    });
    if (customDomains.length > 0) {
      outputs.customDomains = customDomains;
    }

    return outputs;
  }

  async remove(inputs) {
    const { created, environment, serviceId, apiList, customDomains } = inputs;

    // check service exist
    const detail = await this.request({
      Action: 'DescribeService',
      ServiceId: serviceId,
    });

    if (!detail) {
      console.log(`Service ${serviceId} not exist`);
      return;
    }
    // 1. remove all apis
    for (let i = 0; i < apiList.length; i++) {
      const curApi = apiList[i];

      // 1. remove usage plan
      if (curApi.usagePlan) {
        // 1.1 unbind secrete ids
        const { secrets } = curApi.usagePlan;

        if (secrets && secrets.secretIds) {
          await this.removeOrUnbindRequest({
            Action: 'UnBindSecretIds',
            accessKeyIds: secrets.secretIds,
            usagePlanId: curApi.usagePlan.usagePlanId,
          });
          console.log(
            `Unbinding secret key to usage plan with ID ${curApi.usagePlan.usagePlanId}.`,
          );

          // delelet all created api key
          if (curApi.usagePlan.secrets.created === true) {
            for (let sIdx = 0; sIdx < secrets.secretIds.length; sIdx++) {
              const secretId = secrets.secretIds[sIdx];
              console.log(`Removing any previously deployed secret key: ${secretId}`);
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
        await this.removeOrUnbindRequest({
          Action: 'UnBindEnvironment',
          serviceId,
          usagePlanIds: [curApi.usagePlan.usagePlanId],
          environment,
          bindType: curApi.bindType,
          apiIds: [curApi.apiId],
        });
        console.log(
          `Unbinding usage plan with ID ${curApi.usagePlan.usagePlanId} to service with ID ${serviceId}.`,
        );

        // 1.3 delete created usage plan
        if (curApi.usagePlan.created === true) {
          console.log(
            `Removing any previously deployed usage plan ids ${curApi.usagePlan.usagePlanId}`,
          );
          await this.removeOrUnbindRequest({
            Action: 'DeleteUsagePlan',
            usagePlanId: curApi.usagePlan.usagePlanId,
          });
        }
      }

      // 2. delete only apis created by serverless framework
      if (curApi.apiId && curApi.created === true) {
        console.log(`Removing api: ${curApi.apiId}`);
        await this.removeOrUnbindRequest({
          Action: 'DeleteApi',
          apiId: curApi.apiId,
          serviceId,
        });
      }
    }

    // 2. unbind all custom domains
    if (customDomains) {
      for (let i = 0; i < customDomains.length; i++) {
        const curDomain = customDomains[i];
        if (curDomain.subDomain && curDomain.created === true) {
          console.log(`Unbinding custom domain: ${curDomain.subDomain}`);
          await this.removeOrUnbindRequest({
            Action: 'UnBindSubDomain',
            serviceId,
            subDomain: curDomain.subDomain,
          });
        }
      }
    }

    // 3. unrelease service
    console.log(`Unreleasing service: ${serviceId}, environment: ${environment}`);
    await this.removeOrUnbindRequest({
      Action: 'UnReleaseService',
      serviceId,
      environmentName: environment,
    });
    console.log(`Unrelease service: ${serviceId}, environment: ${environment} success`);

    if (created === true) {
      // delete service
      console.log(`Removing service: ${serviceId}`);
      await this.removeOrUnbindRequest({
        Action: 'DeleteService',
        serviceId,
      });
      console.log(`Remove service: ${serviceId} success`);
    }
  }
}

module.exports = Apigw;
