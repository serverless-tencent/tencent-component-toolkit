const { Capi } = require('@tencent-sdk/capi');

const Apis = require('./apis');

class BaseTrigger {
  constructor(credentials = {}, region) {
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
}

module.exports = BaseTrigger;
