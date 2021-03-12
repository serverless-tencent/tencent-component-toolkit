import Clb from '../clb';
import Scf from '../scf';

import { ApiServiceType } from '../interface';
import {
  TriggerInputs,
  ClbTriggerInputsParams,
  CreateTriggerReq,
  CreateClbTriggerOutput,
} from './interface';
import BaseTrigger from './base';
import { CapiCredentials, RegionType } from '../interface';

export default class clbTrigger extends BaseTrigger<ClbTriggerInputsParams> {
  clb: Clb;

  constructor({
    credentials = {},
    region = 'ap-guangzhou',
  }: {
    credentials?: CapiCredentials;
    region?: RegionType;
  }) {
    super({ region, credentials, serviceType: ApiServiceType.clb });

    this.clb = new Clb(credentials, region);
  }

  /**
   * 创建 clb 触发器
   * @param {ClbTriggerInputsParams} 创建 clb 触发器参数
   */
  async create({
    inputs,
  }: {
    inputs: TriggerInputs<ClbTriggerInputsParams>;
  }): Promise<CreateClbTriggerOutput> {
    const { parameters, functionName, namespace = 'default', qualifier = '$DEFAULT' } = inputs;
    const { loadBalanceId, domain, protocol, port, url, weight } = parameters!;

    const output: CreateClbTriggerOutput = {
      namespace,
      functionName,
      qualifier,
      loadBalanceId,
      listenerId: '',
      locationId: '',
      domain,
      protocol,
      port,
      url,
      weight,
    };

    const rule = await this.clb.createRule({
      loadBalanceId: loadBalanceId,
      domain: domain,
      protocol: protocol,
      port: port,
      url: url,
    });

    console.log(
      `[CLB] Binding rule(domain: ${domain}, url: ${url}) of ${loadBalanceId} for ${functionName}`,
    );
    await this.clb.bindTrigger({
      loadBalanceId: rule.loadBalanceId,
      listenerId: rule.listenerId,
      locationId: rule.locationId,
      functionName,
      namespace,
      qualifier,
      weight,
    });

    output.listenerId = rule.listenerId;
    output.locationId = rule.locationId;

    console.log(
      `[CLB] Bind rule(domain: ${domain}, url: ${url}) of ${loadBalanceId} for ${functionName} success`,
    );

    return output;
  }

  /**
   * 删除 clb 触发器
   * @param {scf: Scf, inputs: TriggerInputs} 删除 clb 触发器参数
   */
  async delete({ scf, inputs }: { scf: Scf; inputs: TriggerInputs<ClbTriggerInputsParams> }) {
    console.log(`[CLB] Removing clb trigger ${inputs.triggerName} for ${inputs.functionName}`);
    try {
      const { RequestId } = await scf.request({
        Action: 'DeleteTrigger',
        FunctionName: inputs.functionName,
        Namespace: inputs.namespace,
        Type: 'clb',
        TriggerDesc: inputs.triggerDesc,
        TriggerName: inputs.triggerName,
        Qualifier: inputs.qualifier,
      });
      console.log(
        `[CLB] Remove clb trigger ${inputs.triggerName} for ${inputs.functionName} success`,
      );
      return {
        requestId: RequestId,
        success: true,
      };
    } catch (e) {
      console.log(
        `[CLB] Remove clb trigger ${inputs.triggerName} for ${inputs.functionName} error: ${e.message}`,
      );
      return false;
    }
  }

  // <loadBalanceId>/<listenerId>/<locationId>, 比如：lb-l6golr1k/lbl-6aocx3wi/loc-aoa0k3s0
  async getKey(triggerInputs: CreateTriggerReq) {
    const { TriggerDesc, ResourceId } = triggerInputs;
    if (ResourceId) {
      // ResourceId 格式：qcs::clb:gz:uin/100015854621:lb-l6golr1k/lbl-6aocx3wi/loc-aoa0k3s0
      return ResourceId.slice(ResourceId.lastIndexOf(':') + 1);
    }

    const { loadBalanceId, protocol, port, domain, url } = TriggerDesc;
    const rule = await this.clb.getRule({
      loadBalanceId,
      protocol,
      port,
      domain,
      url,
    });
    let triggerKey = '';
    if (rule) {
      triggerKey = `${loadBalanceId}/${rule.ListenerId}/${rule.LocationId}`;
    }

    return triggerKey;
  }

  async formatInputs({
    inputs,
  }: {
    region?: RegionType;
    inputs: TriggerInputs<ClbTriggerInputsParams>;
  }) {
    const { parameters } = inputs;
    const {
      loadBalanceId,
      domain,
      protocol,
      port,
      url,
      weight,
      qualifier = '$DEFAULT',
      enable,
    } = parameters!;
    const triggerInputs: CreateTriggerReq = {
      Type: 'clb',
      Qualifier: qualifier,
      TriggerName: '',
      TriggerDesc: {
        loadBalanceId,
        domain,
        port,
        protocol,
        url,
        weight,
      },
      Enable: enable ? 'OPEN' : 'CLOSE',
    };

    const triggerKey = await this.getKey(triggerInputs);

    return {
      triggerInputs,
      triggerKey,
    } as any;
  }
}

// CreateRule {"serviceType":"clb","action":"CreateRule","regionId":4,"data":{"Version":"2018-03-17","Region":"ap-shanghai","ListenerId":"lbl-pk163z8v","LoadBalancerId":"lb-ht446s0z","Rules":[{"Domain":"175.24.155.250","Url":"/3/"}]}}
// RegisterFunctionTargets {"serviceType":"clb","action":"RegisterFunctionTargets","regionId":4,"data":{"Version":"2018-03-17","Region":"ap-shanghai","LoadBalancerId":"lb-ht446s0z","ListenerId":"lbl-pk163z8v","LocationId":"loc-i3x9dbnz","FunctionTargets":[{"Weight":10,"Function":{"FunctionName":"clb-test-2","FunctionNamespace":"default","FunctionQualifier":"$DEFAULT"}}]}}
// DescribeListeners {"serviceType":"clb","action":"DescribeListeners","regionId":4,"data":{"Version":"2018-03-17","Region":"ap-shanghai","LoadBalancerId":"lb-ht446s0z"}}
// DeleteTrigger {"serviceType":"scf","action":"DeleteTrigger","regionId":4,"data":{"Version":"2018-04-16","Region":"ap-shanghai","FunctionName":"clb-test-2","Namespace":"default","Type":"clb","Qualifier":"$DEFAULT","TriggerName":"clb_c14bverv4mic5p2eqp20","TriggerDesc":"{\"clbId\":\"lb-ht446s0z\",\"listenerId\":\"lbl-pk163z8v\",\"protocol\":\"HTTP\",\"port\":80,\"host\":\"175.24.155.250\",\"url\":\"/2\",\"fullUrl\":\"http://175.24.155.250/2\"}"}}
