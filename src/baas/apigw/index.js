const { apigw } = require('tencent-cloud-sdk')
const { uniqueArray } = require('../../utils/index')

class ApigwBaas {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou'
    this.credentials = credentials
    this.apigwClient = new apigw(this.credentials)
  }

  getProtocolString(protocols) {
    const tempProtocol = protocols.join('&').toLowerCase()
    return tempProtocol === 'https&http' ? 'http&https' : tempProtocol ? tempProtocol : 'http&https'
  }

  async request(inputs) {
    inputs.Region = this.region
    const result = await this.apigwClient.request(inputs)
    if (result.code != 0) {
      throw new Error(`Request API ${inputs.Action} failed: ${result.message}`)
    } else {
      return result
    }
  }

  async createOrUpdateService(serviceConf) {
    const {
      serviceId,
      protocols,
      serviceName = 'Serverless_Framework',
      serviceDesc = 'Created By Serverless Framework'
    } = serviceConf
    let serviceCreated = false
    let detail
    if (serviceId) {
      detail = await this.request({
        Action: 'DescribeService',
        serviceId: serviceId
      })
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
          protocol: protocols
        })
      }
    } else {
      detail = await this.request({
        Action: 'CreateService',
        serviceName: serviceName || 'Serverless_Framework',
        serviceDesc: serviceDesc || 'Created By Serverless Framework',
        protocol: protocols
      })
      serviceCreated = true
    }

    return {
      serviceId: detail.serviceId,
      subDomain: detail.subDomain,
      serviceCreated
    }
  }

  async createOrUpdateApi({ serviceId, endpoint }) {
    const output = {
      path: endpoint.path,
      method: endpoint.method,
      apiId: undefined,
      created: false
    }

    const apiInputs = {
      protocol: endpoint.protocol || 'HTTP',
      serviceId: serviceId,
      apiName: endpoint.apiName || 'index',
      apiDesc: endpoint.description,
      apiType: 'NORMAL',
      authRequired: endpoint.auth ? 'TRUE' : 'FALSE',
      enableCORS: endpoint.enableCORS ? 'TRUE' : 'FALSE',
      serviceType: 'SCF',
      requestConfig: {
        path: endpoint.path,
        method: endpoint.method
      },
      serviceTimeout: endpoint.serviceTimeout || 15,
      responseType: endpoint.responseType || 'HTML',
      enableCORS: endpoint.enableCORS === true ? 'TRUE' : 'FALSE'
    }

    const funcName = endpoint.function.functionName
    const funcNamespace = endpoint.function.functionNamespace || 'default'
    const funcQualifier = endpoint.function.functionQualifier
      ? endpoint.function.functionQualifier
      : '$LATEST'
      ? endpoint.function.functionQualifier
      : '$LATEST'

    if (endpoint.protocol === 'WEBSOCKET') {
      if (!endpoint.function.transportFunctionName) {
        throw new Error('"endpoints.function.transportFunctionName" is required')
      }
      apiInputs.serviceWebsocketTransportFunctionName = endpoint.function.transportFunctionName
      apiInputs.serviceWebsocketTransportFunctionQualifier = funcQualifier
      apiInputs.serviceWebsocketTransportFunctionNamespace = funcNamespace

      apiInputs.serviceWebsocketRegisterFunctionName = endpoint.function.registerFunctionName
      apiInputs.serviceWebsocketRegisterFunctionQualifier = funcQualifier
      apiInputs.serviceWebsocketRegisterFunctionNamespace = funcNamespace

      apiInputs.serviceWebsocketCleanupFunctionName = endpoint.function.cleanupFunctionName
      apiInputs.serviceWebsocketCleanupFunctionQualifier = funcQualifier
      apiInputs.serviceWebsocketCleanupFunctionNamespace = funcNamespace
    } else {
      if (!funcName) {
        throw new Error('"endpoints.function.functionName" is required')
      }
      apiInputs.serviceScfFunctionName = funcName
      apiInputs.serviceScfFunctionNamespace = funcNamespace
      ;(apiInputs.serviceScfIsIntegratedResponse = endpoint.function.isIntegratedResponse
        ? 'TRUE'
        : 'FALSE'),
        (apiInputs.serviceScfFunctionQualifier = funcQualifier)
    }

    if (endpoint.param) {
      apiInputs.requestParameters = endpoint.param
    }

    if (!endpoint.apiId) {
      const { apiId } = await this.request({
        Action: 'CreateApi',
        ...apiInputs
      })
      output.apiId = apiId
      output.created = true
      console.debug(`API with id ${output.apiId} created.`)
    } else {
      console.debug(`Updating api with api id ${endpoint.apiId}.`)
      await this.request({
        Action: 'ModifyApi',
        apiId: endpoint.appId,
        ...apiInputs
      })
      output.apiId = endpoint.apiId
      console.debug(`Service with id ${output.apiId} updated.`)
    }

    const { internalDomain } = await this.request({
      Action: 'DescribeApi',
      serviceId: serviceId,
      apiId: output.apiId
    })
    output.internalDomain = internalDomain
    return output
  }

  async setupUsagePlanSecret({ secretName, secretIds }) {
    const secretIdsOutput = {
      created: false,
      secretIds
    }

    if (secretIds.length === 0) {
      console.debug(`Creating a new Secret key.`)
      const { secretId, secretKey } = await this.request({
        Action: 'CreateApiKey',
        secretName: secretName,
        type: 'auto'
      })
      console.debug(`Secret key with ID ${secretId} and key ${secretKey} updated.`)
      secretIdsOutput.secretIds = [secretId]
      secretIdsOutput.created = true
    } else {
      const uniqSecretIds = uniqueArray(secretIds)

      // get all secretId, check local secretId exists
      const { apiKeyStatusSet } = await this.request({
        Action: 'DescribeApiKeysStatus',
        secretIds: uniqSecretIds,
        limit: uniqSecretIds.length
      })
      const existKeysLen = apiKeyStatusSet.length

      const ids = []
      for (let i = 0; i < uniqSecretIds.length; i++) {
        const secretId = uniqSecretIds[i]
        let found = false
        let disable = false
        for (let n = 0; n < existKeysLen; n++) {
          if (apiKeyStatusSet[n] && secretId == apiKeyStatusSet[n].secretId) {
            if (apiKeyStatusSet[n].status == 1) {
              found = true
            } else {
              disable = true
              console.debug(`There is a disabled secret key: ${secretId}, cannot be bound`)
            }
            break
          }
        }
        if (!found) {
          if (!disable) {
            console.debug(`Secret key id ${secretId} does't exist`)
          }
        } else {
          ids.push(secretId)
        }
      }
      secretIdsOutput.secretIds = ids
    }

    return secretIdsOutput
  }

  async setupApiUsagePlan({ endpoint }) {
    const { usagePlan = {} } = endpoint

    const usageInputs = {
      usagePlanName: usagePlan.usagePlanName || '',
      usagePlanDesc: usagePlan.usagePlanDesc || '',
      maxRequestNumPreSec: usagePlan.maxRequestNumPreSec || 1000,
      maxRequestNum: usagePlan.maxRequestNum || -1
    }

    const usagePlanOutput = {
      created: false,
      id: usagePlan.usagePlanId
    }

    if (!usagePlan.usagePlanId) {
      usagePlanOutput.id = await this.request({
        Action: 'CreateUsagePlan',
        ...usageInputs
      })
      usagePlanOutput.created = true
      console.debug(`Usage plan with ID ${usagePlanOutput.id} created.`)
    } else {
      console.debug(`Updating usage plan with id ${usagePlan.usagePlanId}.`)
      await this.request({
        Action: 'ModifyUsagePlan',
        usagePlanId: usagePlanOutput.id,
        ...usageInputs
      })
    }

    return usagePlanOutput
  }

  async bindCustomDomain({ serviceId, subDomain, inputs }) {
    const { customDomains, oldState = {} } = inputs
    // 1. unbind all custom domain
    const customDomainDetail = await this.request({
      Action: 'DescribeServiceSubDomains',
      serviceId
    })
    if (
      customDomainDetail &&
      customDomainDetail.domainSet &&
      customDomainDetail.domainSet.length > 0
    ) {
      const { domainSet = [] } = customDomainDetail
      // unbind all created domain
      const stateDomains = oldState.customDomains || []
      for (let i = 0; i < domainSet.length; i++) {
        const domainItem = domainSet[i]
        for (let j = 0; j < stateDomains.length; j++) {
          // only list subDomain and created in state
          if (stateDomains[j].subDomain === domainItem.domainName) {
            console.debug(
              `Start unbind previus domain ${domainItem.domainName} for service ${serviceId}`
            )
            await this.request({
              Action: 'UnBindSubDomain',
              serviceId,
              subDomain: domainItem.domainName
            })
          }
        }
      }
    }
    // 2. bind user config domain
    const customDomainOutput = []
    if (customDomains && customDomains.length > 0) {
      console.debug(`Start bind custom domain for service ${serviceId}`)
      for (let i = 0; i < customDomains.length; i++) {
        const domainItem = customDomains[i]
        const domainProtocol = domainItem.protocols
          ? this.getProtocolString(domainItem.protocols)
          : inputs.protocols
        const domainInputs = {
          serviceId,
          subDomain: domainItem.domain,
          certificateId: domainItem.certificateId,
          isDefaultMapping: domainItem.isDefaultMapping || 'TRUE',
          pathMappingSet: domainItem.pathMappingSet || [],
          protocol: domainProtocol
        }
        await this.request({
          Action: 'BindSubDomain',
          ...domainInputs
        })
        customDomainOutput.push({
          created: true,
          subDomain: domainItem.domain,
          cname: subDomain
        })
        console.debug(`Custom domain for service ${serviceId} created successfullly.`)
        console.debug(`Please add CNAME record ${subDomain} for ${domainItem.domain}.`)
      }
    }

    return customDomainOutput
  }

  async deploy(inputs) {
    const { oldState = {} } = inputs
    inputs.protocols = this.getProtocolString(inputs.protocols)

    const { serviceId, subDomain, serviceCreated } = await this.createOrUpdateService(inputs)

    const apiList = []
    const stateApiList = oldState.apiList || []

    const { endpoints } = inputs
    for (let i = 0, len = endpoints.length; i < len; i++) {
      const endpoint = endpoints[i]
      const curApi = await this.createOrUpdateApi({
        serviceId,
        endpoint
      })
      // if exist in state list, set created to be true
      const exists = stateApiList.filter(
        (item) =>
          item.method.toLowerCase() === endpoint.method.toLowerCase() && item.path === endpoint.path
      )
      if (exists && exists.length > 0) {
        curApi.created = true
      }

      // TODO: set api auth and use plan
      // if (endpoint.auth) {
      //   await this.setupUsagePlan
      // }

      apiList.push(curApi)
      console.debug(
        `Deployment successful for the api named ${endpoint.apiName} in the ${this.region} region.`
      )
    }

    console.debug(`Deploying service with id ${serviceId}.`)
    await this.request({
      Action: 'ReleaseService',
      serviceId: serviceId,
      environmentName: inputs.environment,
      releaseDesc: 'Serverless api-gateway component deploy'
    })

    const outputs = {
      created: serviceCreated,
      serviceId,
      subDomain,
      protocols: inputs.protocols,
      environment: inputs.environment,
      apiList
    }

    // bind custom domain
    const customDomains = await this.bindCustomDomain({
      serviceId,
      subDomain,
      inputs
    })
    if (customDomains.length > 0) {
      outputs.customDomains = customDomains
    }

    return outputs
  }

  async remove(inputs) {
    const { created, environment, serviceId, apiList, customDomains } = inputs
    // remove all apis
    for (let i = 0; i < apiList.length; i++) {
      const curApi = apiList[i]
      // TODO: remove usagePlan and api auth(secretIds)
      // delete only apis created by serverless framework
      if (curApi.apiId && curApi.created === true) {
        console.debug(`Removing api: ${curApi.apiId}`)
        await this.request({
          Action: 'DeleteApi',
          apiId: curApi.apiId,
          serviceId
        })
      }
    }
    // unbind all custom domains
    for (let i = 0; i < customDomains.length; i++) {
      const curDomain = customDomains[i]
      if (curDomain.subDomain && curDomain.created === true) {
        console.debug(`Unbinding custom domain: ${curDomain.subDomain}`)
        await this.request({
          Action: 'UnBindSubDomain',
          serviceId,
          subDomain: curDomain.subDomain
        })
      }
    }

    // unrelease service
    console.debug(`Unreleasing service: ${serviceId}, environment: ${environment}`)
    await this.request({
      Action: 'UnReleaseService',
      serviceId,
      environmentName: environment,
      unReleaseDesc: 'Offlined By Serverless Framework'
    })

    if (created === true) {
      // delete service
      console.debug(`Removing service: ${serviceId}`)
      await this.request({
        Action: 'DeleteService',
        serviceId
      })
    }
  }
}

module.exports = ApigwBaas
