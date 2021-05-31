import { CapiCredentials, RegionType } from './../interface';
import { Cls } from '@tencent-sdk/cls';
import { ClsTriggerInputsParams, TriggerInputs, CreateTriggerReq } from './interface';
import Scf from '../scf';
import BaseTrigger from './base';
import { createClsTrigger, deleteClsTrigger, getClsTrigger, updateClsTrigger } from '../cls/utils';
import { TriggerManager } from './manager';

export default class ClsTrigger extends BaseTrigger<ClsTriggerInputsParams> {
  client: Cls;
  constructor({ credentials, region }: { credentials: CapiCredentials; region: RegionType }) {
    super();
    this.client = new Cls({
      region,
      secretId: credentials.SecretId!,
      secretKey: credentials.SecretKey!,
      token: credentials.Token,
      debug: false,
    });
  }

  getKey(triggerInputs: CreateTriggerReq) {
    if (triggerInputs.ResourceId) {
      // from ListTriggers API
      const rStrArr = triggerInputs.ResourceId.split('/');
      return rStrArr[rStrArr.length - 1];
    }

    return triggerInputs.TriggerDesc?.topic_id ?? '';
  }

  formatInputs({ inputs }: { inputs: TriggerInputs<ClsTriggerInputsParams> }) {
    const { parameters } = inputs;
    const qualifier = parameters?.qualifier ?? inputs.Qualifier ?? '$DEFAULT';
    const triggerInputs: CreateTriggerReq = {
      Type: 'cls',
      Qualifier: qualifier,
      TriggerName: '',
      TriggerDesc: {
        effective: parameters?.enable,
        // FIXME: casing
        function_name: inputs.FunctionName,
        max_size: parameters?.maxSize,
        max_wait: parameters?.maxWait,
        name_space: inputs.Namespace,
        qualifier,
        topic_id: parameters?.topicId,
      },
      Enable: parameters?.enable ? 'OPEN' : 'CLOSE',
    };

    const triggerKey = this.getKey(triggerInputs);

    return {
      triggerInputs,
      triggerKey,
    } as any;
  }

  async get(data: { topicId?: string }) {
    const exist = await getClsTrigger(this.client, {
      topic_id: data.topicId,
    });
    return exist;
  }

  async create({ inputs }: { inputs: TriggerInputs<ClsTriggerInputsParams> }) {
    const { parameters } = inputs;
    const exist = await this.get({
      topicId: parameters?.topicId,
    });
    const qualifier = parameters?.qualifier || '$DEFAULT';
    const namespace = inputs.namespace || 'default';
    const output = {
      namespace,
      functionName: inputs.functionName,
      ...parameters,
      qualifier,
    };
    const clsInputs = {
      topic_id: parameters?.topicId,
      name_space: namespace,
      function_name: inputs.functionName || inputs.function?.name,
      qualifier: qualifier,
      max_wait: parameters?.maxWait,
      max_size: parameters?.maxSize,
      effective: parameters?.enable,
    };
    if (exist) {
      await updateClsTrigger(this.client, clsInputs);
      return output;
    }
    await createClsTrigger(this.client, clsInputs);
    return output;
  }

  async deleteByTopicId({ topicId }: { topicId: string }) {
    const res = await deleteClsTrigger(this.client, {
      topic_id: topicId,
    });
    return res;
  }

  async delete({
    scf,
    inputs,
  }: {
    scf: Scf | TriggerManager;
    inputs: TriggerInputs<ClsTriggerInputsParams>;
  }) {
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
