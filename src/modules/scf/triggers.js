const BaseTrigger = {
  async create(scf, region, funcInfo, inputs) {
    const { triggerInputs } = this.formatInputs(region, funcInfo, inputs);
    console.log(`Creating ${triggerInputs.Type} trigger ${triggerInputs.TriggerName}`);
    const { TriggerInfo } = await scf.request(triggerInputs);
    return TriggerInfo;
  },
  async delete(scf, funcInfo, inputs) {
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
  },
};

const TRIGGER_STATUS_MAP = {
  OPEN: 'OPEN',
  CLOSE: 'CLOSE',
  1: 'OPEN',
  0: 'CLOSE',
};

const TimerTrigger = {
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
  },
  formatInputs(region, funcInfo, inputs) {
    const { parameters, name } = inputs;
    const triggerInputs = {
      Action: 'CreateTrigger',
      FunctionName: funcInfo.FunctionName,
      Namespace: funcInfo.Namespace,
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
  },
  async create(scf, region, funcInfo, inputs) {
    return BaseTrigger.create.bind(this)(scf, region, funcInfo, inputs);
  },
  async delete(scf, funcInfo, inputs) {
    return BaseTrigger.delete.bind(this)(scf, funcInfo, inputs);
  },
};

const CosTrigger = {
  getKey(triggerInputs) {
    const tempDest = JSON.stringify({
      bucketUrl: triggerInputs.TriggerName,
      event: JSON.parse(triggerInputs.TriggerDesc).event,
      filter: JSON.parse(triggerInputs.TriggerDesc).filter,
    });
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable];
    return `cos-${triggerInputs.TriggerName}-${tempDest}-${Enable}-${triggerInputs.Qualifier}`;
  },
  formatInputs(region, funcInfo, inputs) {
    const { parameters } = inputs;
    const triggerInputs = {
      Action: 'CreateTrigger',
      FunctionName: funcInfo.FunctionName,
      Namespace: funcInfo.Namespace,
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
  },
  async create(scf, region, funcInfo, inputs) {
    return BaseTrigger.create.bind(this)(scf, region, funcInfo, inputs);
  },
  async delete(scf, funcInfo, inputs) {
    return BaseTrigger.delete.bind(this)(scf, funcInfo, inputs);
  },
};

const CkafkaTrigger = {
  getKey(triggerInputs) {
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable];
    return `${triggerInputs.Type}-${triggerInputs.TriggerName}-${triggerInputs.TriggerDesc}-${Enable}-${triggerInputs.Qualifier}`;
  },
  formatInputs(region, funcInfo, inputs) {
    const { parameters } = inputs;
    const triggerInputs = {
      Action: 'CreateTrigger',
      FunctionName: funcInfo.FunctionName,
      Namespace: funcInfo.Namespace,
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
  },
  async create(scf, region, funcInfo, inputs) {
    return BaseTrigger.create.bind(this)(scf, region, funcInfo, inputs);
  },
  async delete(scf, funcInfo, inputs) {
    return BaseTrigger.delete.bind(this)(scf, funcInfo, inputs);
  },
};

const CmqTrigger = {
  getKey(triggerInputs) {
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable];
    return `${triggerInputs.Type}-${triggerInputs.TriggerName}-${triggerInputs.TriggerDesc}-${Enable}-${triggerInputs.Qualifier}`;
  },
  formatInputs(region, funcInfo, inputs) {
    const { parameters } = inputs;
    const triggerInputs = {
      Action: 'CreateTrigger',
      FunctionName: funcInfo.FunctionName,
      Namespace: funcInfo.Namespace,
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
  },
  async create(scf, region, funcInfo, inputs) {
    return BaseTrigger.create.bind(this)(scf, region, funcInfo, inputs);
  },
  async delete(scf, funcInfo, inputs) {
    return BaseTrigger.delete.bind(this)(scf, funcInfo, inputs);
  },
};

const ApigwTrigger = {
  formatInputs(region, funcInfo, inputs) {
    const { parameters, name } = inputs;
    const triggerInputs = {};
    triggerInputs.oldState = parameters.oldState;
    triggerInputs.region = region;
    triggerInputs.protocols = parameters.protocols;
    triggerInputs.protocols = parameters.protocols;
    triggerInputs.environment = parameters.environment;
    triggerInputs.serviceId = parameters.serviceId;
    triggerInputs.serviceName = parameters.serviceName || name;
    triggerInputs.serviceDesc = parameters.description;
    triggerInputs.serviceId = parameters.serviceId;

    triggerInputs.endpoints = (parameters.endpoints || []).map((ep) => {
      ep.function = ep.function || {};
      ep.function.functionName = funcInfo.FunctionName;
      ep.function.functionNamespace = funcInfo.Namespace;
      ep.function.functionQualifier = ep.function.functionQualifier
        ? ep.function.functionQualifier
        : '$DEFAULT';
      return ep;
    });
    if (parameters.netTypes) {
      triggerInputs.netTypes = parameters.netTypes;
    }
    triggerInputs.created = !!parameters.created;
    return {
      triggerInputs,
    };
  },
  async create(scf, region, funcInfo, inputs) {
    const { triggerInputs } = this.formatInputs(region, funcInfo, inputs);
    const res = await scf.apigwClient.deploy(triggerInputs);
    return res;
  },
  async delete(scf, region, funcInfo, inputs) {
    const triggerInputs = this.formatInputs(region, funcInfo, inputs);
    try {
      await scf.apigwClient.remove({
        created: true,
        environment: triggerInputs.environment,
        serviceId: triggerInputs.serviceId,
        apiList: {},
      });
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  },
};

module.exports = {
  timer: TimerTrigger,
  cos: CosTrigger,
  apigw: ApigwTrigger,
  ckafka: CkafkaTrigger,
  cmq: CmqTrigger,
};
