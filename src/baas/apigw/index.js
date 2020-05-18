const { apigw } = require('tencent-cloud-sdk')
const { uniqueArray } = require('../../utils/index')

class Apigw {
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
    let exist = false
    if (serviceId) {
      try {
        detail = await this.request({
          Action: 'DescribeService',
          serviceId: serviceId
        })
        exist = true
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
      } catch (e) {}
    }
    if (!exist) {
      const createData = await this.request({
        Action: 'CreateService',
        serviceName: serviceName || 'Serverless_Framework',
        serviceDesc: serviceDesc || 'Created By Serverless Framework',
        protocol: protocols
      })
      detail = createData.data
      serviceCreated = true
    }

    return {
      serviceName,
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
      apiInputs.serviceScfIsIntegratedResponse = endpoint.function.isIntegratedResponse
        ? 'TRUE'
        : 'FALSE'
      apiInputs.serviceScfFunctionQualifier = funcQualifier
    }

    if (endpoint.param) {
      apiInputs.requestParameters = endpoint.param
    }

    let exist = false

    // 没有apiId，还需要根据path来确定
    if (!endpoint.apiId) {
      const pathAPIList = await this.request({
        Action: 'DescribeApisStatus',
        serviceId: serviceId,
        searchName: endpoint.path
      })
      if (pathAPIList.apiIdStatusSet) {
        for (let i = 0; i < pathAPIList.apiIdStatusSet.length; i++) {
          if (
            pathAPIList.apiIdStatusSet[i].method == endpoint.method &&
            pathAPIList.apiIdStatusSet[i].path == endpoint.path
          ) {
            endpoint.apiId = pathAPIList.apiIdStatusSet[i].apiId
          }
        }
      }
    }

    if (endpoint.apiId) {
      try {
        const detail = await this.request({
          Action: 'DescribeApi',
          serviceId: serviceId,
          apiId: endpoint.apiId
        })
        if (detail && detail.apiId) {
          exist = true
          console.log(`Updating api with api id ${endpoint.apiId}.`)
          await this.request({
            Action: 'ModifyApi',
            apiId: endpoint.apiId,
            ...apiInputs
          })
          output.apiId = endpoint.apiId
          console.log(`Service with id ${output.apiId} updated.`)
          output.internalDomain = detail.internalDomain
        }
      } catch (e) {}
    }

    if (!exist) {
      const { apiId } = await this.request({
        Action: 'CreateApi',
        ...apiInputs
      })
      output.apiId = apiId
      output.created = true
      console.log(`API with id ${output.apiId} created.`)

      try {
        const { internalDomain } = await this.request({
          Action: 'DescribeApi',
          serviceId: serviceId,
          apiId: output.apiId
        })
        output.internalDomain = internalDomain
      } catch (e) {}
    }

    output.apiName = apiInputs.apiName
    return output
  }

  async setupUsagePlanSecret({ secretName, secretIds }) {
    const secretIdsOutput = {
      created: false,
      secretIds
    }

    if (secretIds.length === 0) {
      console.log(`Creating a new Secret key.`)
      const { secretId, secretKey } = await this.request({
        Action: 'CreateApiKey',
        secretName: secretName,
        type: 'auto'
      })
      console.log(`Secret key with ID ${secretId} and key ${secretKey} updated.`)
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
              console.log(`There is a disabled secret key: ${secretId}, cannot be bound`)
            }
            break
          }
        }
        if (!found) {
          if (!disable) {
            console.log(`Secret key id ${secretId} does't exist`)
          }
        } else {
          ids.push(secretId)
        }
      }
      secretIdsOutput.secretIds = ids
    }

    return secretIdsOutput
  }

  async setupApiUsagePlan({ usagePlan }) {
    const usageInputs = {
      usagePlanName: usagePlan.usagePlanName || '',
      usagePlanDesc: usagePlan.usagePlanDesc || '',
      maxRequestNumPreSec: usagePlan.maxRequestNumPreSec || 1000,
      maxRequestNum: usagePlan.maxRequestNum || -1
    }

    const usagePlanOutput = {
      created: usagePlan.created || false,
      usagePlanId: usagePlan.usagePlanId
    }

    if (!usagePlan.usagePlanId) {
      const createUsagePlan = await this.request({
        Action: 'CreateUsagePlan',
        ...usageInputs
      })
      usagePlanOutput.usagePlanId = createUsagePlan.usagePlanId
      usagePlanOutput.created = true
      console.log(`Usage plan with ID ${usagePlanOutput.id} created.`)
    } else {
      console.log(`Updating usage plan with id ${usagePlan.usagePlanId}.`)
      await this.request({
        Action: 'ModifyUsagePlan',
        usagePlanId: usagePlanOutput.usagePlanId,
        ...usageInputs
      })
    }

    return usagePlanOutput
  }

  /**
   * get all unbound secretids
   */
  async getUnboundSecretIds({ usagePlanId, secretIds }) {
    const getAllBoundSecrets = async (res = [], { limit, offset = 0 }) => {
      const { secretIdList } = await this.request({
        Action: 'DescribeUsagePlanSecretIds',
        usagePlanId,
        limit,
        offset
      })
      if (secretIdList.length < limit) {
        return secretIdList
      }
      const more = await getAllBoundSecrets(secretIdList, {
        limit,
        offset: offset + secretIdList.length
      })
      return res.concat(more.secretIdList)
    }
    const allBoundSecretObjs = await getAllBoundSecrets([], { limit: 100 })
    const allBoundSecretIds = allBoundSecretObjs.map((item) => item.secretId)

    const unboundSecretIds = secretIds.filter((item) => {
      if (allBoundSecretIds.indexOf(item) === -1) {
        return true
      }
      console.log(`Usage plan ${usagePlanId} secret id ${item} already bound`)
      return false
    })
    return unboundSecretIds
  }

  // bind custom domains
  async bindCustomDomain({ serviceId, subDomain, inputs }) {
    const { customDomains, oldState = {} } = inputs
    if (!customDomains) {
      return []
    }
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
            console.log(
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
      console.log(`Start bind custom domain for service ${serviceId}`)
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
        console.log(`Custom domain for service ${serviceId} created successfullly.`)
        console.log(`Please add CNAME record ${subDomain} for ${domainItem.domain}.`)
      }
    }

    return customDomainOutput
  }

  // bind environment fo usage plan
  async bindUsagePlanEnvironment({
    environment,
    bindType = 'API',
    serviceId,
    apiId,
    endpoint,
    usagePlan
  }) {
    const { usagePlanList } = await this.request({
      Action: 'DescribeApiUsagePlan',
      serviceId,
      apiIds: [apiId]
    })

    const oldUsagePlan = usagePlanList.find((item) => item.usagePlanId === usagePlan.usagePlanId)
    if (oldUsagePlan) {
      console.log(
        `Usage plan with id ${usagePlan.usagePlanId} already bind to api id ${apiId} path ${endpoint.method} ${endpoint.path}.`
      )
    } else {
      console.log(
        `Binding usage plan with id ${usagePlan.usagePlanId} to api id ${apiId} path ${endpoint.method} ${endpoint.path}.`
      )
      await this.request({
        Action: 'BindEnvironment',
        serviceId,
        environment,
        bindType: bindType,
        usagePlanIds: [usagePlan.usagePlanId],
        apiIds: [apiId]
      })
      console.log('Binding successed.')
    }
  }

  async deploy(inputs) {
    const { environment, oldState = {} } = inputs
    inputs.protocols = this.getProtocolString(inputs.protocols)

    const { serviceId, serviceName, subDomain, serviceCreated } = await this.createOrUpdateService(
      inputs
    )

    const apiList = []
    const stateApiList = oldState.apiList || []

    const { endpoints } = inputs
    for (let i = 0, len = endpoints.length; i < len; i++) {
      const endpoint = endpoints[i]
      // if exist in state list, set created to be true
      const [exist] = stateApiList.filter(
        (item) =>
          item.method.toLowerCase() === endpoint.method.toLowerCase() && item.path === endpoint.path
      )

      if (exist) {
        endpoint.apiId = exist.apiId
      }
      const curApi = await this.createOrUpdateApi({
        serviceId,
        endpoint
      })
      if (exist) {
        curApi.created = true
      }

      // set api auth and use plan
      if (endpoint.auth) {
        curApi.bindType = endpoint.bindType || 'API'
        const usagePlan = await this.setupApiUsagePlan({
          usagePlan: {
            ...((exist && exist.usagePlan) || {}),
            ...endpoint.usagePlan
          }
        })
        // store in api list
        curApi.usagePlan = usagePlan

        const { secretIds = [] } = endpoint.auth
        const secrets = await this.setupUsagePlanSecret({
          secretName: endpoint.auth.secretName,
          secretIds
        })
        const unboundSecretIds = await this.getUnboundSecretIds({
          usagePlanId: usagePlan.usagePlanId,
          secretIds: secrets.secretIds
        })
        if (unboundSecretIds.length > 0) {
          console.log(
            `Binding secret key ${unboundSecretIds} to usage plan with id ${usagePlan.usagePlanId}.`
          )
          await this.request({
            Action: 'BindSecretIds',
            usagePlanId: usagePlan.usagePlanId,
            secretIds: unboundSecretIds
          })
          console.log('Binding secret key successed.')
        }
        // store in api list
        curApi.usagePlan.secrets = secrets

        // bind environment
        await this.bindUsagePlanEnvironment({
          environment,
          serviceId,
          apiId: curApi.apiId,
          bindType: curApi.bindType,
          usagePlan,
          endpoint
        })
      }

      apiList.push(curApi)
      console.log(
        `Deployment successful for the api named ${endpoint.apiName} in the ${this.region} region.`
      )
    }

    console.log(`Releaseing service with id ${serviceId}, environment: ${inputs.environment}`)
    await this.request({
      Action: 'ReleaseService',
      serviceId: serviceId,
      environmentName: inputs.environment,
      releaseDesc: 'Serverless api-gateway component deploy'
    })
    console.log(`Deploy service with id ${serviceId} successfully.`)

    const outputs = {
      created: serviceCreated,
      serviceId,
      serviceName,
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
    // check service exist
    try {
      await this.request({
        Action: 'DescribeService',
        serviceId: serviceId
      })
    } catch (e) {
      console.log(`Service ${serviceId} not exist`)
      return
    }
    // 1. remove all apis
    for (let i = 0; i < apiList.length; i++) {
      const curApi = apiList[i]

      // 1. remove usage plan
      if (curApi.usagePlan) {
        // 1.1 unbind secrete ids
        const { secrets } = curApi.usagePlan
        if (secrets && secrets.secretIds) {
          await this.request({
            Action: 'UnBindSecretIds',
            secretIds: secrets.secretIds,
            usagePlanId: curApi.usagePlan.usagePlanId
          })
          console.log(`Unbinding secret key to usage plan with ID ${curApi.usagePlan.usagePlanId}.`)

          // delelet all created api key
          if (curApi.usagePlan.secrets.created === true) {
            for (let sIdx = 0; sIdx < secrets.secretIds.length; sIdx++) {
              const secretId = secrets.secretIds[sIdx]
              await this.request({
                Action: 'DisableApiKey',
                secretId
              })
              await this.request({
                Action: 'DeleteApiKey',
                secretId
              })
              console.log(`Removing any previously deployed secret key. ${secretId}`)
            }
          }
        }

        // 1.2 unbind environment
        await this.request({
          Action: 'UnBindEnvironment',
          serviceId,
          usagePlanIds: [curApi.usagePlan.usagePlanId],
          environment,
          bindType: curApi.bindType,
          apiIds: [curApi.apiId]
        })
        console.log(
          `Unbinding usage plan with ID ${curApi.usagePlan.usagePlanId} to service with ID ${serviceId}.`
        )

        // 1.3 delete created usage plan
        if (curApi.usagePlan.created === true) {
          console.log(
            `Removing any previously deployed usage plan ids ${curApi.usagePlan.usagePlanId}`
          )
          await this.request({
            Action: 'DeleteUsagePlan',
            usagePlanId: curApi.usagePlan.usagePlanId
          })
        }
      }

      // 2. delete only apis created by serverless framework
      if (curApi.apiId && curApi.created === true) {
        console.log(`Removing api: ${curApi.apiId}`)
        await this.request({
          Action: 'DeleteApi',
          apiId: curApi.apiId,
          serviceId
        })
      }
    }

    // 2. unbind all custom domains
    if (customDomains) {
      for (let i = 0; i < customDomains.length; i++) {
        const curDomain = customDomains[i]
        if (curDomain.subDomain && curDomain.created === true) {
          console.log(`Unbinding custom domain: ${curDomain.subDomain}`)
          await this.request({
            Action: 'UnBindSubDomain',
            serviceId,
            subDomain: curDomain.subDomain
          })
        }
      }
    }

    // 3. unrelease service
    console.log(`Unreleasing service: ${serviceId}, environment: ${environment}`)
    await this.request({
      Action: 'UnReleaseService',
      serviceId,
      environmentName: environment,
      unReleaseDesc: 'Offlined By Serverless Framework'
    })

    if (created === true) {
      // delete service
      console.log(`Removing service: ${serviceId}`)
      await this.request({
        Action: 'DeleteService',
        serviceId
      })
    }
  }
}

module.exports = Apigw
