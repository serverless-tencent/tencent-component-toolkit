const { MPS } = require('./apis');
const { camelCaseProperty } = require('../../utils/index');
const { BaseTrigger, TRIGGER_STATUS_MAP } = require('./base');

class MpsTrigger extends BaseTrigger {
  async request({ Action, ...data }) {
    const result = await MPS[Action](this.capi, camelCaseProperty(data));
    return result;
  }

  getKey(triggerInputs) {
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable];

    if (triggerInputs.ResourceId) {
      // from ListTriggers API
      const rStrArr = triggerInputs.ResourceId.split('/');
      return `${rStrArr[rStrArr.length - 1]}-${Enable}`;
    }

    return `${triggerInputs.TriggerDesc.eventType}Event-${Enable}`;
  }

  formatInputs({ inputs }) {
    const data = inputs.parameters;
    const triggerInputs = {};

    triggerInputs.Type = 'mps';
    triggerInputs.Qualifier = data.qualifier || '$DEFAULT';
    triggerInputs.TriggerName = '';
    triggerInputs.TriggerDesc = {
      eventType: data.type,
    };

    triggerInputs.Enable = data.enable ? 'OPEN' : 'CLOSE';

    const triggerKey = this.getKey(triggerInputs);

    return {
      triggerInputs,
      triggerKey,
    };
  }

  async getTypeTrigger({ eventType, functionName, namespace, qualifier }) {
    const allList = await this.getTriggerList({
      functionName,
      namespace,
      qualifier,
    });
    const [exist] = allList.filter(
      (item) => item.ResourceId.indexOf(`TriggerType/${eventType}Event`) !== -1,
    );
    if (exist) {
      return exist;
    }
    return null;
  }

  async create({ inputs }) {
    const data = inputs.parameters;
    const output = {
      namespace: inputs.namespace || 'default',
      functionName: inputs.functionName,
      ...data,
    };
    // check exist type trigger
    const existTypeTrigger = await this.getTypeTrigger({
      eventType: data.type,
      qualifier: data.qualifier || '$DEFAULT',
      namespace: inputs.namespace || 'default',
      functionName: inputs.functionName,
    });
    let needBind = false;
    if (existTypeTrigger) {
      if (data.enable === false) {
        await this.request({
          Action: 'UnbindTrigger',
          Type: 'mps',
          Qualifier: data.qualifier || '$DEFAULT',
          FunctionName: inputs.functionName,
          Namespace: inputs.namespace || 'default',
          ResourceId: existTypeTrigger.ResourceId,
        });
      } else if (existTypeTrigger.BindStatus === 'off') {
        needBind = true;
      }
      output.resourceId = existTypeTrigger.ResourceId;
    } else {
      needBind = true;
    }

    if (needBind) {
      const res = await this.request({
        Action: 'BindTrigger',
        ScfRegion: this.region,
        EventType: data.type,
        Qualifier: data.qualifier || '$DEFAULT',
        FunctionName: inputs.functionName,
        Namespace: inputs.namespace || 'default',
      });

      output.resourceId = res.ResourceId;
    }

    return output;
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

module.exports = MpsTrigger;
