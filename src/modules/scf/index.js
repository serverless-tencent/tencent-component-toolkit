const { sleep, waitResponse } = require('@ygkit/request');
const { Capi } = require('@tencent-sdk/capi');
const { TypeError, ApiError } = require('../../utils/error');
const { deepClone, strip } = require('../../utils');
const TagsUtils = require('../tag/index');
const ApigwUtils = require('../apigw/index');
const Cam = require('../cam/index');
const { formatFunctionInputs } = require('./utils');
const CONFIGS = require('./config');
const Apis = require('./apis');
const TRIGGERS = require('../triggers');
const { CAN_UPDATE_TRIGGER } = require('../triggers/base');

class Scf {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.tagClient = new TagsUtils(this.credentials, this.region);
    this.apigwClient = new ApigwUtils(this.credentials, this.region);

    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      AppId: this.credentials.AppId,
      SecretId: this.credentials.SecretId,
      SecretKey: this.credentials.SecretKey,
      Token: this.credentials.Token,
    });
  }

  async request({ Action, ...data }) {
    const result = await Apis[Action](this.capi, data);
    return result;
  }

  // bind SCF_QcsRole role
  async bindScfQCSRole() {
    console.log(`Creating and binding SCF_QcsRole`);
    const camClient = new Cam(this.credentials);
    const roleName = 'SCF_QcsRole';
    const policyId = 28341895;
    try {
      await camClient.request({
        Action: 'CreateRole',
        Version: '2019-01-16',
        Region: this.region,
        RoleName: roleName,
        PolicyDocument: JSON.stringify({
          version: '2.0',
          statement: [
            {
              effect: 'allow',
              principal: {
                service: 'scf.qcloud.com',
              },
              action: 'sts:AssumeRole',
            },
          ],
        }),
      });
    } catch (e) {}
    try {
      await camClient.request({
        Action: 'AttachRolePolicy',
        Version: '2019-01-16',
        Region: this.region,
        AttachRoleName: roleName,
        PolicyId: policyId,
      });
    } catch (e) {}
  }

  // get function detail
  async getFunction(namespace, functionName, qualifier = '$LATEST', showCode = false) {
    try {
      const Response = await this.request({
        Action: 'GetFunction',
        FunctionName: functionName,
        Namespace: namespace,
        Qualifier: qualifier,
        ShowCode: showCode ? 'TRUE' : 'FALSE',
      });
      return Response;
    } catch (e) {
      if (e.code == 'ResourceNotFound.FunctionName' || e.code == 'ResourceNotFound.Function') {
        return null;
      }
      throw new ApiError({
        type: 'API_SCF_GetFunction',
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  // check function status
  // because creating/upadting function is asynchronous
  // if not become Active in 120 * 1000 miniseconds, return request result, and throw error
  async checkStatus(namespace = 'default', functionName, qualifier = '$LATEST') {
    let initialInfo = await this.getFunction(namespace, functionName, qualifier);
    let { Status } = initialInfo;
    let times = 120;
    while (CONFIGS.waitStatus.indexOf(Status) !== -1 && times > 0) {
      initialInfo = await this.getFunction(namespace, functionName, qualifier);
      if (!initialInfo) {
        return true;
      }
      ({ Status } = initialInfo);
      // if change to failed status break loop
      if (CONFIGS.failStatus.indexOf(Status) !== -1) {
        break;
      }
      await sleep(1000);
      times = times - 1;
    }
    const { StatusReasons } = initialInfo;
    return Status !== 'Active'
      ? StatusReasons && StatusReasons.length > 0
        ? `函数状态异常, ${StatusReasons[0].ErrorMessage}`
        : `函数状态异常, ${Status}`
      : true;
  }

  // create function
  async createFunction(inputs) {
    console.log(`Creating function ${inputs.name} in ${this.region}`);
    const functionInputs = await formatFunctionInputs(this.region, inputs);
    functionInputs.Action = 'CreateFunction';
    await this.request(functionInputs);
    return true;
  }

  // update function code
  async updateFunctionCode(inputs, funcInfo) {
    console.log(`Updating function ${inputs.name} code in ${this.region}`);
    const functionInputs = await formatFunctionInputs(this.region, inputs);
    const updateFunctionConnfigure = {
      Action: 'UpdateFunctionCode',
      Handler: functionInputs.Handler || funcInfo.Handler,
      FunctionName: functionInputs.FunctionName,
      CosBucketName: functionInputs.Code.CosBucketName,
      CosObjectName: functionInputs.Code.CosObjectName,
      Namespace: inputs.Namespace || funcInfo.Namespace,
    };
    await this.request(updateFunctionConnfigure);
    return true;
  }

  // update function configure
  async updatefunctionConfigure(inputs, funcInfo) {
    console.log(`Updating function ${inputs.name} configure in ${this.region}`);
    const functionInputs = await formatFunctionInputs(this.region, inputs);
    functionInputs.Action = 'UpdateFunctionConfiguration';
    functionInputs.Timeout = inputs.timeout || funcInfo.Timeout;
    functionInputs.Namespace = inputs.namespace || funcInfo.Namespace;
    functionInputs.MemorySize = inputs.memorySize || funcInfo.MemorySize;
    if (!functionInputs.ClsLogsetId) {
      functionInputs.ClsLogsetId = '';
      functionInputs.ClsTopicId = '';
    }
    // can not update handler,code,codesource
    delete functionInputs.Handler;
    delete functionInputs.Code;
    delete functionInputs.CodeSource;
    delete functionInputs.AsyncRunEnable;
    // +++++++++++++++++++++++
    // Below are very strange logical for layer unbind, but backend api need me to do this.
    // handle unbind one layer
    if (functionInputs.Layers && functionInputs.Layers.length === 0) {
      functionInputs.Layers.push({
        LayerName: '',
        LayerVersion: 0,
      });
    }
    // handler empty environment variables
    if (
      !functionInputs.Environment ||
      !functionInputs.Environment.Variables ||
      functionInputs.Environment.Variables.length === 0
    ) {
      functionInputs.Environment = { Variables: [{ Key: '', Value: '' }] };
    }
    await this.request(functionInputs);
    return true;
  }

  async getTriggerList(functionName, namespace = 'default') {
    const { Triggers = [], TotalCount } = await this.request({
      Action: 'ListTriggers',
      FunctionName: functionName,
      Namespace: namespace,
      Limit: 100,
    });
    if (TotalCount > 100) {
      const res = await this.getTriggerList(functionName, namespace);
      return Triggers.concat(res);
    }

    return Triggers;
  }

  filterTriggers(funcInfo, events, oldList) {
    const deleteList = deepClone(oldList);
    const createList = deepClone(events);
    // const noKeyTypes = ['apigw'];
    const updateList = [];
    events.forEach((event, index) => {
      const Type = Object.keys(event)[0];
      const triggerClass = TRIGGERS[Type];
      const triggerInstance = new triggerClass({
        credentials: this.credentials,
        region: this.region,
      });
      const { triggerKey } = triggerInstance.formatInputs({
        region: this.region,
        inputs: {
          namespace: funcInfo.Namespace,
          functionName: funcInfo.FunctionName,
          ...event[Type],
        },
      });
      for (let i = 0; i < oldList.length; i++) {
        const curOld = oldList[i];
        if (curOld.Type === Type) {
          const oldTriggerClass = TRIGGERS[curOld.Type];
          const oldTriggerInstance = new oldTriggerClass({
            credentials: this.credentials,
            region: this.region,
          });
          const oldKey = oldTriggerInstance.getKey(curOld);

          if (oldKey === triggerKey) {
            deleteList[i] = null;
            updateList.push(createList[index]);
            if (CAN_UPDATE_TRIGGER.indexOf(Type) === -1) {
              createList[index] = null;
            }
          }
        }
      }
    });
    return {
      updateList,
      deleteList: deleteList.filter((item) => item),
      createList: createList.filter((item) => item),
    };
  }

  // deploy SCF triggers
  async deployTrigger(funcInfo, inputs) {
    console.log(`Deploying triggers for function ${funcInfo.FunctionName}`);

    // should check function status is active, then continue
    await this.isOperationalStatus(inputs.namespace, inputs.name);

    // get all triggers
    const triggerList = await this.getTriggerList(funcInfo.FunctionName, funcInfo.Namespace);

    const { deleteList, createList } = this.filterTriggers(funcInfo, inputs.events, triggerList);

    // remove all old triggers
    for (let i = 0, len = deleteList.length; i < len; i++) {
      const curTrigger = deleteList[i];
      const { Type } = curTrigger;
      const triggerClass = TRIGGERS[Type];
      const triggerInstance = new triggerClass({
        credentials: this.credentials,
        region: this.region,
      });
      if (triggerClass) {
        await triggerInstance.delete({
          scf: this,
          region: this.region,
          inputs: {
            namespace: funcInfo.Namespace,
            functionName: funcInfo.FunctionName,
            type: curTrigger.Type,
            triggerDesc: curTrigger.TriggerDesc,
            triggerName: curTrigger.TriggerName,
            qualifier: curTrigger.Qualifier,
          },
        });
      }
    }

    // create all new triggers
    const triggerResult = [];
    for (let i = 0; i < createList.length; i++) {
      const event = createList[i];
      const Type = Object.keys(event)[0];
      const triggerClass = TRIGGERS[Type];
      if (!triggerClass) {
        throw TypeError('PARAMETER_SCF', `Unknow trigger type ${Type}`);
      }
      const triggerInstance = new triggerClass({
        credentials: this.credentials,
        region: this.region,
      });
      const triggerOutput = await triggerInstance.create({
        scf: this,
        region: this.region,
        inputs: {
          namespace: funcInfo.Namespace,
          functionName: funcInfo.FunctionName,
          ...event[Type],
        },
      });

      triggerResult.push(triggerOutput);
    }
    return triggerResult;
  }

  // delete function
  async deleteFunction(namespace, functionName) {
    namespace = namespace || CONFIGS.defaultNamespace;
    const res = await this.request({
      Action: 'DeleteFunction',
      FunctionName: functionName,
      Namespace: namespace,
    });

    try {
      await waitResponse({
        callback: async () => this.getFunction(namespace, functionName),
        targetResponse: null,
        timeout: 120 * 1000,
      });
    } catch (e) {
      throw new ApiError({
        type: 'API_SCF_DeleteFunction',
        message: `Cannot delete function in 2 minutes, (reqId: ${res.RequestId})`,
      });
    }
    return true;
  }

  /**
   * publish function version
   * @param {object} inputs publish version parameter
   */
  async publishVersion(inputs) {
    console.log(`Publishing function ${inputs.functionName} version`);
    const publishInputs = {
      Action: 'PublishVersion',
      FunctionName: inputs.functionName,
      Description: inputs.description || 'Published by Serverless Component',
      Namespace: inputs.namespace || 'default',
    };
    const Response = await this.request(publishInputs);

    console.log(`Published function ${inputs.functionName} version ${Response.FunctionVersion}`);
    return Response;
  }

  async publishVersionAndConfigTraffic(inputs) {
    const weight = strip(1 - inputs.traffic);
    const publishInputs = {
      Action: 'CreateAlias',
      FunctionName: inputs.functionName,
      FunctionVersion: inputs.functionVersion,
      Name: inputs.aliasName,
      Namespace: inputs.namespace || 'default',
      RoutingConfig: {
        AdditionalVersionWeights: [{ Version: inputs.functionVersion, Weight: weight }],
      },
      Description: inputs.description || 'Published by Serverless Component',
    };
    const Response = await this.request(publishInputs);
    return Response;
  }

  async updateAliasTraffic(inputs) {
    const weight = strip(1 - inputs.traffic);
    console.log(
      `Config function ${inputs.functionName} traffic ${weight} for version ${inputs.lastVersion}`,
    );
    const publishInputs = {
      Action: 'UpdateAlias',
      FunctionName: inputs.functionName,
      FunctionVersion: inputs.functionVersion || '$LATEST',
      Name: inputs.aliasName || '$DEFAULT',
      Namespace: inputs.namespace || 'default',
      RoutingConfig: {
        AdditionalVersionWeights: [{ Version: inputs.lastVersion, Weight: weight }],
      },
      Description: inputs.description || 'Configured by Serverless Component',
    };
    const Response = await this.request(publishInputs);
    console.log(
      `Config function ${inputs.functionName} traffic ${weight} for version ${inputs.lastVersion} success`,
    );
    return Response;
  }

  async createAlias(inputs) {
    const publishInputs = {
      Action: 'CreateAlias',
      FunctionName: inputs.functionName,
      FunctionVersion: inputs.functionVersion,
      Name: inputs.aliasName,
      Namespace: inputs.namespace || 'default',
      RoutingConfig: {
        AdditionalVersionWeights: [{ Version: inputs.lastVersion, Weight: inputs.traffic }],
      },
      Description: inputs.description || 'Published by Serverless Component',
    };
    const Response = await this.request(publishInputs);
    return Response;
  }

  async updateAlias(inputs) {
    console.log(
      `Config function ${inputs.functionName} traffic ${inputs.traffic} for version ${inputs.lastVersion}`,
    );
    const publishInputs = {
      Action: 'UpdateAlias',
      FunctionName: inputs.functionName,
      FunctionVersion: inputs.functionVersion || '$LATEST',
      Name: inputs.aliasName || '$DEFAULT',
      Namespace: inputs.namespace || 'default',
      RoutingConfig: {
        AdditionalVersionWeights: [{ Version: inputs.lastVersion, Weight: inputs.traffic }],
      },
      Description: inputs.description || 'Configured by Serverless Component',
    };
    const Response = await this.request(publishInputs);
    console.log(
      `Config function ${inputs.functionName} traffic ${inputs.traffic} for version ${inputs.lastVersion} success`,
    );
    return Response;
  }

  async getAlias(inputs) {
    const publishInputs = {
      Action: 'GetAlias',
      FunctionName: inputs.functionName,
      Name: inputs.aliasName || '$DEFAULT',
      Namespace: inputs.namespace || 'default',
    };
    const Response = await this.request(publishInputs);
    return Response;
  }

  async deleteAlias(inputs) {
    const publishInputs = {
      Action: 'DeleteAlias',
      FunctionName: inputs.functionName,
      Name: inputs.aliasName || '$DEFAULT',
      Namespace: inputs.namespace || 'default',
    };
    const Response = await this.request(publishInputs);
    return Response;
  }

  async listAlias(inputs) {
    const publishInputs = {
      Action: 'ListAliases',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace || 'default',
      FunctionVersion: inputs.functionVersion,
    };
    const Response = await this.request(publishInputs);
    return Response;
  }

  /**
   * check whether function status is operational, mostly for asynchronous operation
   * @param {string} namespace
   * @param {string} functionName funcitn name
   */
  async isOperationalStatus(namespace, functionName, qualifier = '$LATEST') {
    // after create/update function, should check function status is active, then continue
    const res = await this.checkStatus(namespace, functionName, qualifier);
    if (res === true) {
      return true;
    }
    throw new TypeError('API_SCF_isOperationalStatus', res);
  }

  async tryToDeleteFunction(namespace, functionName) {
    try {
      console.log(`正在尝试删除创建失败的函数，命令空间：${namespace}，函数名称：${functionName}`);
      await this.deleteFunction(namespace, functionName);
      await this.isOperationalStatus(namespace, functionName);
    } catch (e) {}
  }

  // check whether scf is operational
  async isOperational(namespace, functionName, qualifier = '$LATEST') {
    const funcInfo = await this.getFunction(namespace, functionName, qualifier);
    if (funcInfo) {
      const { Status, StatusReasons } = funcInfo;
      const reason = StatusReasons && StatusReasons.length > 0 ? StatusReasons[0].ErrorMessage : '';
      if (Status === 'Active') {
        return true;
      }
      let errorMsg = '';
      switch (Status) {
        case 'Creating':
          errorMsg = '当前函数正在创建中，无法更新代码，请稍后再试';
          break;
        case 'Updating':
          errorMsg = '当前函数正在更新中，无法更新代码，请稍后再试';
          break;
        case 'Publishing':
          errorMsg = '当前函数正在版本发布中，无法更新代码，请稍后再试';
          break;
        case 'Deleting':
          errorMsg = '当前函数正在删除中，无法更新代码，请稍后再试';
          break;
        case 'CreateFailed':
          console.log(`函数创建失败，${reason || Status}`);
          await this.tryToDeleteFunction(namespace, functionName);
          break;
        case 'DeleteFailed':
          errorMsg = `函数删除失败，${reason || Status}`;
          break;
      }
      if (errorMsg) {
        throw new TypeError('API_SCF_isOperational', errorMsg);
      }
    }
  }

  // deploy SCF flow
  async deploy(inputs = {}) {
    const namespace = inputs.namespace || CONFIGS.defaultNamespace;

    // before deploy a scf, we should check whether
    // if is CreateFailed, try to remove it
    await this.isOperational(namespace, inputs.name);

    // whether auto create/bind role
    if (inputs.enableRoleAuth) {
      await this.bindScfQCSRole();
    }
    // check SCF exist
    // exist: update it, not: create it
    let funcInfo = await this.getFunction(namespace, inputs.name);
    if (!funcInfo) {
      await this.createFunction(inputs);
    } else {
      await this.updateFunctionCode(inputs, funcInfo);

      // should check function status is active, then continue
      await this.isOperationalStatus(namespace, inputs.name);

      await this.updatefunctionConfigure(inputs, funcInfo);
    }

    // should check function status is active, then continue
    await this.isOperationalStatus(namespace, inputs.name);

    // after create/update function, get latest function info
    funcInfo = await this.getFunction(namespace, inputs.name);

    const outputs = funcInfo;
    if (inputs.publish) {
      const { FunctionVersion } = await this.publishVersion({
        functionName: funcInfo.FunctionName,
        region: this.region,
        namespace,
        description: inputs.publishDescription,
      });
      inputs.lastVersion = FunctionVersion;
      outputs.LastVersion = FunctionVersion;

      // should check function status is active, then continue
      await this.isOperationalStatus(namespace, inputs.name, inputs.lastVersion);
    }
    inputs.needSetTraffic =
      inputs.traffic !== undefined && inputs.lastVersion && inputs.lastVersion !== '$LATEST';
    if (inputs.needSetTraffic) {
      await this.updateAliasTraffic({
        functionName: funcInfo.FunctionName,
        region: this.region,
        traffic: inputs.traffic,
        lastVersion: inputs.lastVersion,
        aliasName: inputs.aliasName,
        description: inputs.aliasDescription,
      });
      outputs.Traffic = inputs.traffic;
      outputs.ConfigTrafficVersion = inputs.lastVersion;
    }

    // get default alias
    // if have no access, ignore it
    try {
      const defualtAlias = await this.getAlias({
        functionName: funcInfo.FunctionName,
        region: this.region,
        namespace,
      });
      if (
        defualtAlias &&
        defualtAlias.RoutingConfig &&
        defualtAlias.RoutingConfig.AdditionalVersionWeights &&
        defualtAlias.RoutingConfig.AdditionalVersionWeights.length > 0
      ) {
        const weights = defualtAlias.RoutingConfig.AdditionalVersionWeights;
        let weightSum = 0;
        let lastVersion = weights[0].Version;
        weights.forEach((w) => {
          if (Number(w.Version) > Number(outputs.LastVersion)) {
            lastVersion = w.Version;
          }
          weightSum += w.Weight;
        });
        outputs.LastVersion = lastVersion;
        outputs.ConfigTrafficVersion = lastVersion;
        outputs.Traffic = strip(1 - weightSum);
      }
    } catch (e) {
      // no op
      console.log('API_SCF_getAlias', e.message);
    }

    // create/update tags
    if (inputs.tags) {
      const deployedTags = await this.tagClient.deployResourceTags({
        tags: Object.entries(inputs.tags).map(([TagKey, TagValue]) => ({ TagKey, TagValue })),
        resourceId: `${funcInfo.Namespace}/function/${funcInfo.FunctionName}`,
        serviceType: 'scf',
        resourcePrefix: 'namespace',
      });

      outputs.Tags = deployedTags.map((item) => ({
        Key: item.TagKey,
        Value: item.TagValue,
      }));
    }

    // create/update/delete triggers
    if (inputs.events) {
      outputs.Triggers = await this.deployTrigger(funcInfo, inputs);
    }

    console.log(`Deploy function ${funcInfo.FunctionName} success.`);
    return outputs;
  }

  // 移除函数的主逻辑
  async remove(inputs = {}) {
    const functionName = inputs.functionName || inputs.FunctionName;
    console.log(`Removing function ${functionName}`);
    const namespace = inputs.namespace || inputs.Namespace || CONFIGS.defaultNamespace;

    // check function exist, then delete
    const func = await this.getFunction(namespace, functionName);

    if (!func) {
      console.log(`Function ${functionName} not exist`);
      return true;
    }

    if (func.Status === 'Updating' || func.Status === 'Creating') {
      console.log(`Function ${functionName} status is ${func.Status}, can not delete`);
      return false;
    }

    try {
      await this.isOperationalStatus(namespace, functionName);
    } catch (e) {}

    if (inputs.Triggers) {
      for (let i = 0; i < inputs.Triggers.length; i++) {
        if (inputs.Triggers[i].serviceId) {
          try {
            // delete apigw trigger
            const curTrigger = inputs.Triggers[i];
            await this.apigwClient.remove(curTrigger);
          } catch (e) {
            console.log(e);
          }
        }
      }
    }

    await this.deleteFunction(namespace, functionName);

    console.log(`Remove function ${functionName} success`);

    return true;
  }

  async invoke(inputs = {}) {
    const Response = await this.request({
      Action: 'Invoke',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace || CONFIGS.defaultNamespace,
      ClientContext: JSON.stringify(inputs.clientContext || {}),
      LogType: inputs.logType || 'Tail',
      InvocationType: inputs.invocationType || 'RequestResponse',
    });
    return Response;
  }
}

module.exports = Scf;
