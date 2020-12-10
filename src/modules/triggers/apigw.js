const BaseTrigger = require('./base');
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
}

module.exports = ApigwTrigger;
