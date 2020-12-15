const { TRIGGER_STATUS_MAP } = require('./base');

class CmqTrigger {
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

    triggerInputs.Type = 'cmq';
    triggerInputs.Qualifier = parameters.qualifier || '$DEFAULT';
    triggerInputs.TriggerName = parameters.name;
    triggerInputs.TriggerDesc = JSON.stringify({
      filterType: 1,
      filterKey: parameters.filterKey,
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

module.exports = CmqTrigger;
