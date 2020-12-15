const { Cls } = require('@tencent-sdk/cls');

const {
  createClsTrigger,
  deleteClsTrigger,
  getClsTrigger,
  updateClsTrigger,
} = require('../cls/utils');

class ClsTrigger {
  constructor({ credentials, region }) {
    this.client = new Cls({
      region,
      secretId: credentials.SecretId,
      secretKey: credentials.SecretKey,
      token: credentials.Token,
      debug: false,
    });
  }

  getKey(triggerInputs) {
    if (triggerInputs.ResourceId) {
      // from ListTriggers API
      const rStrArr = triggerInputs.ResourceId.split('/');
      return rStrArr[rStrArr.length - 1];
    }

    return triggerInputs.TriggerDesc.topic_id;
  }
  formatInputs({ inputs }) {
    const data = inputs.parameters;
    const triggerInputs = {};

    triggerInputs.Type = 'cls';
    triggerInputs.Qualifier = data.qualifier || '$DEFAULT';
    triggerInputs.TriggerName = '';
    triggerInputs.TriggerDesc = {
      effective: data.enable,
      function_name: inputs.FunctionName,
      max_size: data.maxSize,
      max_wait: data.maxWait,
      name_space: inputs.Namespace,
      qualifier: triggerInputs.Qualifier,
      topic_id: data.topicId,
    };

    triggerInputs.Enable = data.enable ? 'OPEN' : 'CLOSE';

    const triggerKey = this.getKey(triggerInputs);

    return {
      triggerInputs,
      triggerKey,
    };
  }

  async get(data) {
    const exist = await getClsTrigger(this.client, {
      topic_id: data.topicId,
    });
    return exist;
  }

  async create({ inputs }) {
    const data = inputs.parameters;
    const exist = await this.get({
      topicId: data.topicId,
    });
    const output = {
      namespace: inputs.namespace || 'default',
      functionName: inputs.functionName,
      ...data,
    };
    const clsInputs = {
      topic_id: data.topicId,
      name_space: inputs.namespace || 'default',
      function_name: inputs.functionName,
      qualifier: data.qualifier || '$DEFAULT',
      max_wait: data.maxWait,
      max_size: data.maxSize,
      effective: data.enable,
    };
    if (exist) {
      await updateClsTrigger(this.client, clsInputs);
      return output;
    }
    await createClsTrigger(this.client, clsInputs);
    return output;
  }
  async deleteByTopicId({ topicId }) {
    const res = await deleteClsTrigger(this.client, {
      topic_id: topicId,
    });
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

module.exports = ClsTrigger;
