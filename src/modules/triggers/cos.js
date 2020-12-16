const { TRIGGER_STATUS_MAP } = require('./base');

class CosTrigger {
  constructor({ credentials, region }) {
    this.credentials = credentials;
    this.region = region;
  }
  getKey(triggerInputs) {
    const tempDest = JSON.stringify({
      bucketUrl: triggerInputs.TriggerName,
      event: JSON.parse(triggerInputs.TriggerDesc).event,
      filter: JSON.parse(triggerInputs.TriggerDesc).filter,
    });
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable];
    return `cos-${triggerInputs.TriggerName}-${tempDest}-${Enable}-${triggerInputs.Qualifier}`;
  }
  formatInputs({ inputs }) {
    const { parameters } = inputs;
    const triggerInputs = {
      Action: 'CreateTrigger',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,
    };

    triggerInputs.Type = 'cos';
    triggerInputs.Qualifier = parameters.qualifier || '$DEFAULT';
    triggerInputs.TriggerName = parameters.bucket;
    triggerInputs.TriggerDesc = JSON.stringify({
      event: parameters.events,
      filter: {
        Prefix: parameters.filter && parameters.filter.prefix ? parameters.filter.prefix : '',
        Suffix: parameters.filter && parameters.filter.suffix ? parameters.filter.suffix : '',
      },
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

module.exports = CosTrigger;
