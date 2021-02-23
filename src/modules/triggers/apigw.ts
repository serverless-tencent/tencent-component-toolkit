import { CapiCredentials, RegionType, ApiServiceType } from './../interface';
import BaseTrigger from './base';
import { APIGW, SCF } from './apis';
import {
  ApigwTriggerRemoveScfTriggerInputs,
  TriggerInputs,
  ApigwTriggerRemoveInputs,
  ApigwTriggerInputsParams,
  ApigwTriggerDesc,
  CreateTriggerReq,
  TriggerData,
} from './interface';
import Scf from '../scf';
import { FunctionInfo } from '../scf/interface';

export default class ApigwTrigger extends BaseTrigger<ApigwTriggerInputsParams, ApigwTriggerDesc> {
  constructor({
    credentials = {},
    region = 'ap-guangzhou',
  }: {
    credentials?: CapiCredentials;
    region?: RegionType;
  }) {
    super({ region, credentials, serviceType: ApiServiceType.apigateway });
  }

  /** remove trigger from scf(Serverless Cloud Function) */
  async removeScfTrigger({
    serviceId,
    apiId,
    functionName,
    namespace,
    qualifier,
  }: ApigwTriggerRemoveScfTriggerInputs) {
    // 1. get all trigger list
    const allList = await this.getTriggerList({
      functionName,
      namespace,
      qualifier,
    });

    // 2. get apigw trigger list
    const apigwList = allList.filter((item: { Type: 'apigw' }) => item.Type === 'apigw');

    const [curApiTrigger] = apigwList.filter(({ ResourceId }: { ResourceId: string }) => {
      return ResourceId.indexOf(`service/${serviceId}/API/${apiId}`) !== -1;
    });

    // 3. remove current apigw trigger
    if (curApiTrigger) {
      try {
        await SCF.DeleteTrigger(this.capi, {
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

  /** TODO: */
  async remove({ serviceId, apiId }: ApigwTriggerRemoveInputs) {
    // get api detail
    const apiDetail = await APIGW.DescribeApi(this.capi, {
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

  // apigw trigger key format: `<serviceId>/<apiPath>/<apiMethod>`
  getKey(triggerInputs: CreateTriggerReq): string {
    const { TriggerDesc, ResourceId } = triggerInputs;
    if (ResourceId) {
      // from ListTriggers API
      const rStrArr = ResourceId.split('service/');
      const rStrArr1 = rStrArr[1].split('/API');
      const serviceId = rStrArr1[0];
      try {
        const { api } = JSON.parse(TriggerDesc);
        const { path, method } = api.requestConfig;
        return `${serviceId}/${path}/${method}`;
      } catch (e) {
        return '';
      }
    }

    return `${TriggerDesc.serviceId}/${TriggerDesc.path}/${TriggerDesc.method}`;
  }

  formatInputs(): {
    triggerKey: string;
    triggerInputs: TriggerData<ApigwTriggerDesc>;
  } {
    return {} as any;
  }

  /** 格式化输入 */
  formatApigwInputs({
    region,
    inputs,
  }: {
    region: RegionType;
    inputs: TriggerInputs<ApigwTriggerInputsParams>;
  }) {
    const { parameters } = inputs;
    const {
      oldState,
      protocols,
      environment,
      serviceId,
      serviceName,
      serviceDesc,
      isInputServiceId = false,
    } = parameters!;
    const endpoints = parameters?.endpoints ?? [{ path: '/', method: 'ANY' }];
    const triggerInputs: ApigwTriggerInputsParams = {
      oldState: oldState ?? {},
      region,
      protocols,
      environment,
      serviceId,
      serviceName,
      serviceDesc,

      // 定制化需求：是否在 yaml 文件中配置了 apigw 触发器的 serviceId
      isInputServiceId,

      // 定制化需求：是否是删除云函数的api网关触发器，跟api网关组件区分开
      isRemoveTrigger: true,
      endpoints: endpoints.map((ep: any) => {
        ep.function = ep.function || {};
        ep.function.functionName = inputs.functionName;
        ep.function.functionNamespace = inputs.namespace;
        ep.function.functionQualifier = ep.function.functionQualifier ?? '$DEFAULT';
        return ep;
      }),
      netTypes: parameters?.netTypes,
      TriggerDesc: {
        serviceId: serviceId!,
        path: endpoints[0].path ?? '/',
        method: endpoints[0].method ?? 'ANY',
      },
      created: !!parameters?.created,
    };
    const triggerKey = this.getKey({
      TriggerDesc: {
        serviceId: serviceId!,
      },
    });

    return {
      triggerKey,
      triggerInputs,
    };
  }
  async create({
    scf,
    region,
    inputs,
  }: {
    scf: Scf;
    region: RegionType;
    inputs: TriggerInputs<ApigwTriggerInputsParams>;
    funcInfo?: FunctionInfo;
  }) {
    const { triggerInputs } = this.formatApigwInputs({ region, inputs });
    const res = await scf.apigwClient.deploy(triggerInputs);
    return res;
  }

  /** Delete Apigateway trigger */
  async delete({ scf, inputs }: { scf: Scf; inputs: TriggerInputs }) {
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
