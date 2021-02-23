import { CapiCredentials, RegionType } from './../interface';
import { Cls } from '@tencent-sdk/cls';
import { ClsTriggerParams, TriggerInputs, TriggerData, ClsTriggerDesc } from './interface';
import Scf from '../scf';
import BaseTrigger from './base';
import { createClsTrigger, deleteClsTrigger, getClsTrigger, updateClsTrigger } from '../cls/utils';

export default class ClsTrigger extends BaseTrigger<ClsTriggerParams, ClsTriggerDesc> {
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

  getKey(triggerInputs: TriggerData<ClsTriggerDesc>) {
    if (triggerInputs.ResourceId) {
      // from ListTriggers API
      const rStrArr = triggerInputs.ResourceId.split('/');
      return rStrArr[rStrArr.length - 1];
    }

    return triggerInputs.TriggerDesc?.topic_id ?? '';
  }

  formatInputs({ inputs }: { inputs: TriggerInputs<ClsTriggerParams> }) {
    const { parameters } = inputs;
    const triggerInputs: TriggerData<ClsTriggerDesc> = {
      Type: 'cls',
      Qualifier: parameters?.qualifier ?? '$DEFAULT',
      TriggerName: '',
      TriggerDesc: {
        effective: parameters?.enable,
        // FIXME: casing
        function_name: inputs.FunctionName,
        max_size: parameters?.maxSize,
        max_wait: parameters?.maxWait,
        name_space: inputs.Namespace,
        // FIXME: casing
        qualifier: inputs.Qualifier ?? '$DEFAULT',
        topic_id: parameters?.topicId!,
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

  async create({ inputs }: { inputs: TriggerInputs<ClsTriggerParams> }) {
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
      Qualifier: qualifier,
    };
    const clsInputs = {
      topic_id: parameters?.topicId,
      // FIXME: namespace or name_space?
      name_space: namespace,
      function_name: inputs.functionName,
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

  async delete({ scf, inputs }: { scf: Scf; inputs: TriggerInputs<ClsTriggerParams> }) {
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
