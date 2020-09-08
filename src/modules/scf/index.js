const { sleep } = require('@ygkit/request');
const { Capi } = require('@tencent-sdk/capi');
const { TypeError, ApiError } = require('../../utils/error');
const { strip } = require('../../utils');
const TagsUtils = require('../tag/index');
const ApigwUtils = require('../apigw/index');
const Cam = require('../cam/index');
const { formatTrigger, formatFunctionInputs } = require('./utils');
const CONFIGS = require('./config');
const Apis = require('./apis');

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
    console.log(`Updating function ${inputs.name}'s code in ${this.region}`);
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
    console.log(`Updating function ${inputs.name}'s configure in ${this.region}`);
    const functionInputs = await formatFunctionInputs(this.region, inputs);
    functionInputs.Action = 'UpdateFunctionConfiguration';
    functionInputs.Timeout = inputs.timeout || funcInfo.Timeout;
    functionInputs.Namespace = inputs.namespace || funcInfo.Namespace;
    functionInputs.MemorySize = inputs.memorySize || funcInfo.MemorySize;
    // can not update handler,code,codesource
    delete functionInputs.Handler;
    delete functionInputs.Code;
    delete functionInputs.CodeSource;
    await this.request(functionInputs);
    return true;
  }

  // deploy SCF triggers
  async deployTrigger(funcInfo, inputs) {
    console.log(`Deploying ${inputs.name}'s triggers in ${this.region}.`);

    // should check function status is active, then continue
    await this.isOperationalStatus(inputs.namespace, inputs.name);

    // remove all old triggers
    const oldTriggers = funcInfo.Triggers || [];
    for (let tIdx = 0, len = oldTriggers.length; tIdx < len; tIdx++) {
      const curTrigger = oldTriggers[tIdx];

      if (curTrigger.Type === 'apigw') {
        // TODO: now apigw can not sync in SCF trigger list
        // await this.apigwClient.remove(curTrigger);
      } else {
        console.log(`Removing ${curTrigger.Type} triggers: ${curTrigger.TriggerName}.`);
        await this.request({
          Action: 'DeleteTrigger',
          FunctionName: funcInfo.FunctionName,
          Namespace: funcInfo.Namespace,
          Type: curTrigger.Type,
          TriggerDesc: curTrigger.TriggerDesc,
          TriggerName: curTrigger.TriggerName,
        });
      }
    }

    // create all new triggers
    const deployTriggerResult = [];
    for (let i = 0; i < inputs.events.length; i++) {
      const event = inputs.events[i];
      const eventType = Object.keys(event)[0];

      if (eventType === 'apigw') {
        const { triggerInputs } = formatTrigger(
          eventType,
          this.region,
          funcInfo,
          event[eventType],
          inputs.needSetTraffic,
        );
        try {
          const apigwOutput = await this.apigwClient.deploy(triggerInputs);

          deployTriggerResult.push(apigwOutput);
        } catch (e) {
          throw e;
        }
      } else {
        const { triggerInputs } = formatTrigger(eventType, this.region, funcInfo, event[eventType]);

        console.log(`Creating ${eventType} triggers: ${event[eventType].name}.`);
        const Response = await this.request(triggerInputs);

        deployTriggerResult.push(Response.TriggerInfo);
      }
    }
    funcInfo.Triggers = deployTriggerResult;
    return deployTriggerResult;
  }

  // deploy tags
  async deployTags(funcInfo, inputs) {
    console.log(`Adding tags for function ${inputs.name} in ${this.region}`);
    const deleteTags = {};
    for (let i = 0; i < funcInfo.Tags.length; i++) {
      if (!inputs.tags.hasOwnProperty(funcInfo.Tags[i].Key)) {
        deleteTags[funcInfo.Tags[i].Key] = funcInfo.Tags[i].Value;
      }
    }
    await this.tagClient.deploy({
      resource: `qcs::scf:${this.region}::lam/${funcInfo.FunctionId}`,
      replaceTags: inputs.tags,
      deleteTags: deleteTags,
    });
  }

  // 删除函数
  async deleteFunction(namespace, functionName) {
    await this.request({
      Action: 'DeleteFunction',
      FunctionName: functionName,
      Namespace: namespace || CONFIGS.defaultNamespace,
    });
  }

  /**
   * publish function version
   * @param {object} inputs publish version parameter
   */
  async publishVersion(inputs) {
    console.log(`Publish function ${inputs.functionName} version`);
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

  async getAlias(inputs) {
    const publishInputs = {
      Action: 'GetAlias',
      FunctionName: inputs.functionName,
      Name: inputs.functionVersion || '$DEFAULT',
      Namespace: inputs.namespace || 'default',
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
      await this.deployTags(funcInfo, inputs);
    }

    // create/update/delete triggers
    if (inputs.events) {
      await this.deployTrigger(funcInfo, inputs);
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
      return;
    }

    if (func.Status === 'Updating' || func.Status === 'Creating') {
      console.log(`Function ${functionName} status is ${func.Status}, can not delete`);
      return;
    }

    await this.deleteFunction(namespace, functionName);

    try {
      await this.isOperationalStatus(namespace, functionName);
    } catch (e) {}

    if (inputs.Triggers) {
      for (let i = 0; i < inputs.Triggers.length; i++) {
        if (inputs.Triggers[i].serviceId) {
          try {
            // delete apigw trigger
            inputs.Triggers[i].created = true;
            await this.apigwClient.remove(inputs.Triggers[i]);
          } catch (e) {
            console.log(e);
          }
        }
      }
    }

    console.log(`Remove function ${functionName} and it's triggers success`);

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
