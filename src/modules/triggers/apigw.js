const { BaseTrigger } = require('./base');
const Apis = require('./apis');

class ApigwTrigger extends BaseTrigger {
  async removeScfTrigger({ serviceId, apiId, functionName, namespace, qualifier }) {
    // 1. get all trigger list
    const allList = await this.getTriggerList({
      functionName,
      namespace,
      qualifier,
    });

    // 2. get apigw trigger list
    const apigwList = allList.filter((item) => item.Type === 'apigw');

    const [curApiTrigger] = apigwList.filter(({ ResourceId }) => {
      return ResourceId.indexOf(`service/${serviceId}/API/${apiId}`) !== -1;
    });

    // 3. remove current apigw trigger
    if (curApiTrigger) {
      try {
        await Apis.SCF.DeleteTrigger(this.capi, {
          Type: 'apigw',
          FunctionName: functionName,
          Namespace: namespace,
          Qualifier: qualifier,
          TriggerDesc: curApiTrigger.TriggerDesc,
          TriggerName: curApiTrigger.TriggerName,
        });
      } catch (e) {
        console.log(e);
      }
    }
  }
  async remove({ serviceId, apiId }) {
    // get api detail
    const apiDetail = await Apis.APIGW.DescribeApi(this.capi, {
      ServiceId: serviceId,
      ApiId: apiId,
    });
    if (!apiDetail) {
      return true;
    }

    // 1. scf type
    if (apiDetail.ServiceScfFunctionName) {
      await this.removeScfTrigger({
        serviceId,
        apiId,
        functionName: apiDetail.ServiceScfFunctionName,
        namespace: apiDetail.ServiceScfFunctionNamespace,
        qualifier: apiDetail.ServiceScfFunctionQualifier,
      });
    }

    // 2. ws type
    if (apiDetail.ServiceWebsocketRegisterFunctionName) {
      await this.removeScfTrigger({
        serviceId,
        apiId,
        functionName: apiDetail.ServiceWebsocketRegisterFunctionName,
        namespace: apiDetail.ServiceWebsocketRegisterFunctionNamespace,
        qualifier: apiDetail.ServiceWebsocketRegisterFunctionQualifier,
      });
    }
    if (apiDetail.ServiceWebsocketCleanupFunctionName) {
      await this.removeScfTrigger({
        serviceId,
        apiId,
        functionName: apiDetail.ServiceWebsocketCleanupFunctionName,
        namespace: apiDetail.ServiceWebsocketCleanupFunctionNamespace,
        qualifier: apiDetail.ServiceWebsocketCleanupFunctionQualifier,
      });
    }
    if (apiDetail.ServiceWebsocketTransportFunctionName) {
      await this.removeScfTrigger({
        serviceId,
        apiId,
        functionName: apiDetail.ServiceWebsocketTransportFunctionName,
        namespace: apiDetail.ServiceWebsocketTransportFunctionNamespace,
        qualifier: apiDetail.ServiceWebsocketTransportFunctionQualifier,
      });
    }
    return true;
  }

  getKey(triggerInputs) {
    if (triggerInputs.ResourceId) {
      // from ListTriggers API
      const rStrArr = triggerInputs.ResourceId.split('service/');
      const rStrArr1 = rStrArr[1].split('/API');
      return rStrArr1[0];
    }

    return triggerInputs.TriggerDesc.serviceId;
  }
  formatInputs({ region, inputs }) {
    const { parameters, name } = inputs;
    const triggerInputs = {};
    triggerInputs.oldState = parameters.oldState || {};
    triggerInputs.region = region;
    triggerInputs.protocols = parameters.protocols;
    triggerInputs.protocols = parameters.protocols;
    triggerInputs.environment = parameters.environment;
    triggerInputs.serviceId = parameters.serviceId;
    triggerInputs.serviceName = parameters.serviceName || name;
    triggerInputs.serviceDesc = parameters.description;
    triggerInputs.serviceId = parameters.serviceId;

    triggerInputs.endpoints = (parameters.endpoints || []).map((ep) => {
      ep.function = ep.function || {};
      ep.function.functionName = inputs.functionName;
      ep.function.functionNamespace = inputs.namespace;
      ep.function.functionQualifier = ep.function.functionQualifier
        ? ep.function.functionQualifier
        : '$DEFAULT';
      return ep;
    });
    if (parameters.netTypes) {
      triggerInputs.netTypes = parameters.netTypes;
    }
    triggerInputs.created = !!parameters.created;
    triggerInputs.TriggerDesc = {
      serviceId: triggerInputs.serviceId,
    };
    const triggerKey = this.getKey(triggerInputs);
    return {
      triggerKey,
      triggerInputs,
    };
  }
  async create({ scf, region, inputs }) {
    const { triggerInputs } = this.formatInputs({ region, inputs });
    const res = await scf.apigwClient.deploy(triggerInputs);
    return res;
  }
  async delete({ scf, inputs }) {
    console.log(`Removing ${inputs.type} trigger ${inputs.triggerName}`);
    try {
      const res = await scf.request({
        Action: 'DeleteTrigger',
        FunctionName: inputs.functionName,
        Namespace: inputs.namespace,
        Type: inputs.type,
        TriggerDesc: inputs.triggerDesc,
        TriggerName: inputs.triggerName,
        Qualifier: inputs.qualifier,
      });
      return {
        requestId: res.RequestId,
        success: true,
      };
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}

module.exports = ApigwTrigger;
