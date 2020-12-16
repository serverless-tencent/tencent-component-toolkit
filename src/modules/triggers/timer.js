const { TRIGGER_STATUS_MAP } = require('./base');

class TimerTrigger {
  constructor({ credentials, region }) {
    this.credentials = credentials;
    this.region = region;
  }
  getKey(triggerInputs) {
    // Very strange logical for Enable, fe post Enable is 'OPEN' or 'CLOSE'
    // but get 1 or 0, parameter type cnaged......
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable];
    // Very strange logical for TriggerDesc, fe post TriggerDesc is "0 */6 * * * * *"
    // but get "{"cron":"0 */6 * * * * *"}"
    const Desc =
      triggerInputs.TriggerDesc.indexOf('cron') !== -1
        ? triggerInputs.TriggerDesc
        : JSON.stringify({
            cron: triggerInputs.TriggerDesc,
          });
    return `${triggerInputs.Type}-${triggerInputs.TriggerName}-${Desc}-${triggerInputs.CustomArgument}-${Enable}-${triggerInputs.Qualifier}`;
  }
  formatInputs({ inputs }) {
    const { parameters, name } = inputs;
    const triggerInputs = {
      Action: 'CreateTrigger',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,
    };

    triggerInputs.Type = 'timer';
    triggerInputs.Qualifier = parameters.qualifier || '$DEFAULT';
    triggerInputs.TriggerName = parameters.name || name;
    triggerInputs.TriggerDesc = parameters.cronExpression;
    triggerInputs.Enable = parameters.enable ? 'OPEN' : 'CLOSE';

    if (parameters.argument) {
      triggerInputs.CustomArgument = parameters.argument;
    }
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

module.exports = TimerTrigger;
