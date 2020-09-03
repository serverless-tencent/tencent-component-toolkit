const CONFIGS = require('./config');
const { TypeError } = require('../../utils/error');

/**
 * Format apigw trigger inputs
 * @param {string} region region
 * @param {object} funcInfo function information
 * @param {object} inputs yml configuration
 */
const formatApigwTrigger = (region, funcInfo, inputs, traffic = false) => {
  const { parameters, name } = inputs;
  const triggerInputs = {};
  triggerInputs.region = region;
  triggerInputs.protocols = parameters.protocols;
  triggerInputs.environment = parameters.environment;
  triggerInputs.serviceName = parameters.serviceName || name;
  triggerInputs.serviceDesc = parameters.description;
  triggerInputs.serviceId = parameters.serviceId;

  triggerInputs.endpoints = (parameters.endpoints || []).map((ep) => {
    ep.function = ep.function || {};
    ep.function.functionName = funcInfo.FunctionName;
    ep.function.functionNamespace = funcInfo.Namespace;
    ep.function.functionQualifier = ep.function.functionQualifier
      ? ep.function.functionQualifier
      : traffic
      ? '$DEFAULT'
      : '$LATEST';
    return ep;
  });
  if (parameters.netTypes) {
    triggerInputs.netTypes = parameters.netTypes;
  }
  return {
    triggerInputs,
  };
};

/**
 * Format timer trigger inputs
 * @param {string} region region
 * @param {object} funcInfo function information
 * @param {object} inputs yml configuration
 */
const formatTimerTrigger = (region, funcInfo, inputs) => {
  const { parameters, name } = inputs;
  const triggerInputs = {
    Action: 'CreateTrigger',
    FunctionName: funcInfo.FunctionName,
    Namespace: funcInfo.Namespace,
  };

  triggerInputs.Type = 'timer';
  triggerInputs.TriggerName = name;
  triggerInputs.TriggerDesc = parameters.cronExpression;
  triggerInputs.Enable = parameters.enable ? 'OPEN' : 'CLOSE';

  if (parameters.argument) {
    triggerInputs.CustomArgument = parameters.argument;
  }
  const triggerKey = `${triggerInputs.Type}-${triggerInputs.TriggerName}`;

  return {
    triggerInputs,
    triggerKey,
  };
};

/**
 * Format cos trigger inputs
 * @param {string} region region
 * @param {object} funcInfo function information
 * @param {object} inputs yml configuration
 */
const formatCosTrigger = (region, funcInfo, inputs) => {
  const { parameters } = inputs;
  const triggerInputs = {
    Action: 'CreateTrigger',
    FunctionName: funcInfo.FunctionName,
    Namespace: funcInfo.Namespace,
  };

  triggerInputs.Type = 'cos';
  triggerInputs.TriggerName = parameters.bucket;
  triggerInputs.TriggerDesc = JSON.stringify({
    event: parameters.events,
    filter: {
      Prefix: parameters.filter && parameters.filter.prefix ? parameters.filter.prefix : '',
      Suffix: parameters.filter && parameters.filter.suffix ? parameters.filter.suffix : '',
    },
  });
  triggerInputs.Enable = parameters.enable ? 'OPEN' : 'CLOSE';
  const tempDest = JSON.stringify({
    bucketUrl: triggerInputs.TriggerName,
    event: JSON.parse(triggerInputs.TriggerDesc).event,
    filter: JSON.parse(triggerInputs.TriggerDesc).filter,
  });
  const triggerKey = `cos-${triggerInputs.TriggerName}-${tempDest}`;

  return {
    triggerInputs,
    triggerKey,
  };
};

/**
 * Format ckafka trigger inputs
 * @param {string} region region
 * @param {object} funcInfo function information
 * @param {object} inputs yml configuration
 */
const formatCkafkaTrigger = (region, funcInfo, inputs) => {
  const { parameters } = inputs;
  const triggerInputs = {
    Action: 'CreateTrigger',
    FunctionName: funcInfo.FunctionName,
    Namespace: funcInfo.Namespace,
  };

  triggerInputs.Type = 'ckafka';
  triggerInputs.TriggerName = `${parameters.name}-${parameters.topic}`;
  triggerInputs.TriggerDesc = JSON.stringify({
    maxMsgNum: parameters.maxMsgNum,
    offset: parameters.offset,
  });
  triggerInputs.Enable = parameters.enable ? 'OPEN' : 'CLOSE';
  const triggerKey = `${triggerInputs.Type}-${triggerInputs.TriggerName}`;

  return {
    triggerInputs,
    triggerKey,
  };
};

/**
 * Format Cmq trigger inputs
 * @param {string} region region
 * @param {object} funcInfo function information
 * @param {object} inputs yml configuration
 */
const formatCmqTrigger = (region, funcInfo, inputs) => {
  const { parameters } = inputs;
  const triggerInputs = {
    Action: 'CreateTrigger',
    FunctionName: funcInfo.FunctionName,
    Namespace: funcInfo.Namespace,
  };

  triggerInputs.Type = 'cmq';
  triggerInputs.TriggerName = parameters.name;
  triggerInputs.TriggerDesc = JSON.stringify({
    filterType: 1,
    filterKey: parameters.filterKey,
  });

  triggerInputs.Enable = parameters.enable ? 'OPEN' : 'CLOSE';
  const triggerKey = `${triggerInputs.Type}-${triggerInputs.TriggerName}`;

  return {
    triggerInputs,
    triggerKey,
  };
};

const formatTrigger = (type, region, funcInfo, inputs, traffic) => {
  switch (type) {
    case 'apigw':
      return formatApigwTrigger(region, funcInfo, inputs, traffic);
    case 'timer':
      return formatTimerTrigger(region, funcInfo, inputs);
    case 'cos':
      return formatCosTrigger(region, funcInfo, inputs);
    case 'ckafka':
      return formatCkafkaTrigger(region, funcInfo, inputs);
    case 'cmq':
      return formatCmqTrigger(region, funcInfo, inputs);
    default:
      throw new TypeError('PARAMETER_SCF', `Unknow trigger type ${type}`);
  }
};

// get function basement configure
const formatFunctionInputs = (region, inputs) => {
  const functionInputs = {
    FunctionName: inputs.name,
    CodeSource: 'Cos',
    Code: {
      CosBucketName: inputs.code.bucket,
      CosObjectName: inputs.code.object,
    },
    Handler: inputs.handler,
    Runtime: inputs.runtime,
    Namespace: inputs.namespace || CONFIGS.defaultNamespace,
    Timeout: +inputs.timeout || CONFIGS.defaultTimeout,
    InitTimeout: +inputs.initTimeout || CONFIGS.defaultInitTimeout,
    MemorySize: +inputs.memorySize || CONFIGS.defaultMemorySize,
    PublicNetConfig: {
      PublicNetStatus: inputs.publicAccess === false ? 'DISABLE' : 'ENABLE',
      EipConfig: {
        EipStatus: inputs.eip === true ? 'ENABLE' : 'DISABLE',
      },
    },
    L5Enable: inputs.l5Enable === true ? 'TRUE' : 'FALSE',
  };

  // 非必须参数
  if (inputs.role) {
    functionInputs.Role = inputs.role;
  }
  if (inputs.description) {
    functionInputs.Description = inputs.description;
  }
  if (inputs.cls) {
    if (inputs.cls.logsetId) {
      functionInputs.ClsLogsetId = inputs.cls.logsetId;
    }
    if (inputs.cls.topicId) {
      functionInputs.ClsTopicId = inputs.cls.topicId;
    }
  }
  if (inputs.environment && inputs.environment.variables) {
    functionInputs.Environment = {
      Variables: [],
    };
    Object.entries(inputs.environment.variables).forEach(([key, val]) => {
      functionInputs.Environment.Variables.push({
        Key: key,
        Value: String(val),
      });
    });
  }
  if (inputs.vpcConfig) {
    functionInputs.VpcConfig = {};
    if (inputs.vpcConfig.vpcId) {
      functionInputs.VpcConfig.VpcId = inputs.vpcConfig.vpcId;
    }
    if (inputs.vpcConfig.subnetId) {
      functionInputs.VpcConfig.SubnetId = inputs.vpcConfig.subnetId;
    }
  }
  if (inputs.layers) {
    functionInputs.Layers = [];
    inputs.layers.forEach((item) => {
      functionInputs.Layers.push({
        LayerName: item.name,
        LayerVersion: item.version,
      });
    });
  }
  if (inputs.deadLetter) {
    functionInputs.DeadLetterConfig = {};
    if (inputs.deadLetter.type) {
      functionInputs.DeadLetterConfig.Type = inputs.deadLetter.type;
    }
    if (inputs.deadLetter.name) {
      functionInputs.DeadLetterConfig.Name = inputs.deadLetter.name;
    }
    if (inputs.deadLetter.filterType) {
      functionInputs.DeadLetterConfig.FilterType = inputs.deadLetter.filterType;
    }
  }

  // cfs config
  if (inputs.cfs) {
    functionInputs.CfsConfig = {
      CfsInsList: [],
    };
    inputs.cfs.forEach((item) => {
      functionInputs.CfsConfig.CfsInsList.push({
        CfsId: item.cfsId,
        MountInsId: item.MountInsId || item.cfsId,
        LocalMountDir: item.localMountDir,
        RemoteMountDir: item.remoteMountDir,
        UserGroupId: String(item.userGroupId || 10000),
        UserId: String(item.userId || 10000),
      });
    });
  }

  return functionInputs;
};

module.exports = {
  formatTrigger,
  formatFunctionInputs,
};
