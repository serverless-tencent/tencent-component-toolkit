const { Capi } = require('@tencent-sdk/capi');

const Apis = require('./apis');

class BaseTrigger {
  constructor({ credentials = {}, region }) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;

    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      AppId: this.credentials.AppId,
      SecretId: this.credentials.SecretId,
      SecretKey: this.credentials.SecretKey,
      Token: this.credentials.Token,
    });
  }

  async getTriggerList({ functionName, namespace = 'default', qualifier }) {
    const listOptions = {
      FunctionName: functionName,
      Namespace: namespace,
      Limit: 100,
    };
    if (qualifier) {
      listOptions.Filters = [
        {
          Name: 'Qualifier',
          Values: [qualifier],
        },
      ];
    }
    const { Triggers = [], TotalCount } = await Apis.SCF.ListTriggers(this.capi, listOptions);
    if (TotalCount > 100) {
      const res = await this.getTriggerList(functionName, namespace, qualifier);
      return Triggers.concat(res);
    }

    return Triggers;
  }

  async create({ scf, region, funcInfo, inputs }) {
    const { triggerInputs } = this.formatInputs({ region, funcInfo, inputs });
    console.log(`Creating ${triggerInputs.Type} trigger ${triggerInputs.TriggerName}`);
    const { TriggerInfo } = await scf.request(triggerInputs);
    return TriggerInfo;
  }

  async delete({ scf, funcInfo, inputs }) {
    console.log(`Removing ${inputs.Type} trigger ${inputs.TriggerName}`);
    try {
      await scf.request({
        Action: 'DeleteTrigger',
        FunctionName: funcInfo.FunctionName,
        Namespace: funcInfo.Namespace,
        Type: inputs.Type,
        TriggerDesc: inputs.TriggerDesc,
        TriggerName: inputs.TriggerName,
        Qualifier: inputs.Qualifier,
      });
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}

const TRIGGER_STATUS_MAP = {
  OPEN: 'OPEN',
  CLOSE: 'CLOSE',
  1: 'OPEN',
  0: 'CLOSE',
};

const CAN_UPDATE_TRIGGER = ['apigw', 'cls'];

module.exports = { BaseTrigger, TRIGGER_STATUS_MAP, CAN_UPDATE_TRIGGER };
