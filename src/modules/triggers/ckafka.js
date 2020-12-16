const { TRIGGER_STATUS_MAP } = require('./base');

class CkafkaTrigger {
  constructor({ credentials, region }) {
    this.credentials = credentials;
    this.region = region;
  }
  getKey(triggerInputs) {
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable];
    return `${triggerInputs.Type}-${triggerInputs.TriggerName}-${triggerInputs.TriggerDesc}-${Enable}-${triggerInputs.Qualifier}`;
  }
  formatInputs({ inputs }) {
    const { parameters } = inputs;
    const triggerInputs = {
      Action: 'CreateTrigger',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,
    };

    triggerInputs.Type = 'ckafka';
    triggerInputs.Qualifier = parameters.qualifier || '$DEFAULT';
    triggerInputs.TriggerName = `${parameters.name}-${parameters.topic}`;
    triggerInputs.TriggerDesc = JSON.stringify({
      maxMsgNum: parameters.maxMsgNum,
      offset: parameters.offset,
      retry: parameters.retry,
    });
    triggerInputs.Enable = parameters.enable ? 'OPEN' : 'CLOSE';
    const triggerKey = this.getKey(triggerInputs);

    return {
      triggerInputs,
      triggerKey,
    };
  }
  async create({ scf, region, inputs }) {
    const { triggerInputs } = this.formatInputs({ region, inputs });
    console.log(`Creating ${triggerInputs.Type} trigger ${triggerInputs.TriggerName}`);
    const { TriggerInfo } = await scf.request(triggerInputs);
    return TriggerInfo;
  }
  async delete({ scf, inputs }) {
    console.log(`Removing ${inputs.type} trigger ${inputs.triggerName}`);
    try {
      await scf.request({
        Action: 'DeleteTrigger',
        FunctionName: inputs.functionName,
        Namespace: inputs.namespace,
        Type: inputs.type,
        TriggerDesc: inputs.triggerDesc,
        TriggerName: inputs.triggerName,
        Qualifier: inputs.qualifier,
      });
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}

module.exports = CkafkaTrigger;
