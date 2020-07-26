const { scf, cam } = require('tencent-cloud-sdk');
const { sleep } = require('@ygkit/request');
const { TypeError } = require('../../utils/error');
const { strip } = require('../../utils');
const TagsUtils = require('../tag/index');
const ApigwUtils = require('../apigw/index');
const { formatTrigger, formatFunctionInputs } = require('./utils');
const CONFIGS = require('./config');

class Scf {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.scfClient = new scf(this.credentials);
    this.tagClient = new TagsUtils(this.credentials, this.region);
    this.apigwClient = new ApigwUtils(this.credentials, this.region);
  }

  // 绑定默认策略
  async bindScfQCSRole() {
    console.log(`Creating and binding SCF_QcsRole ...`);
    const camClient = new cam(this.credentials);
    const roleName = 'SCF_QcsRole';
    const policyId = 28341895;
    // 创建默认角色
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
    //  绑定默认策略
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
      const funcInfo = await this.scfClient.request({
        Action: 'GetFunction',
        Version: '2018-04-16',
        Region: this.region,
        FunctionName: functionName,
        Namespace: namespace,
        Qualifier: qualifier,
        ShowCode: showCode ? 'TRUE' : 'FALSE',
      });
      if (funcInfo.Response && funcInfo.Response.Error) {
        if (
          funcInfo.Response.Error.Code == 'ResourceNotFound.FunctionName' ||
          funcInfo.Response.Error.Code == 'ResourceNotFound.Function'
        ) {
          return null;
        }
        throw new TypeError(
          'API_SCF_GetFunction',
          JSON.stringify(funcInfo.Response),
          null,
          funcInfo.Response.RequestId,
        );
      } else {
        return funcInfo.Response;
      }
    } catch (e) {
      throw new TypeError('API_SCF_GetFunction', e.message, e.stack);
    }
  }

  // check function status
  // because creating/upadting function is asynchronous
  // if not become Active in 120 * 1000 miniseconds, return request result, and throw error
  async checkStatus(namespace = 'default', functionName, qualifier = '$LATEST') {
    console.log(`Checking function ${functionName} status ...`);
    let initialInfo = await this.getFunction(namespace, functionName, qualifier);
    let status = initialInfo.Status;
    let times = 120;
    while (CONFIGS.waitStatus.indexOf(status) !== -1 && times > 0) {
      initialInfo = await this.getFunction(namespace, functionName, qualifier);
      status = initialInfo.Status;
      await sleep(1000);
      times = times - 1;
    }
    return status !== 'Active' ? initialInfo : true;
  }

  // create function
  async createFunction(inputs) {
    console.log(`Creating function ${inputs.name} in ${this.region} ... `);
    const functionInputs = await formatFunctionInputs(this.region, inputs);
    functionInputs.Action = 'CreateFunction';
    const funcInfo = await this.scfClient.request(functionInputs);
    if (funcInfo.Response && funcInfo.Response.Error) {
      throw new TypeError(
        'API_SCF_CreateFunction',
        JSON.stringify(funcInfo.Response),
        null,
        funcInfo.Response.RequestId,
      );
    } else {
      return true;
    }
  }

  // update function code
  async updateFunctionCode(inputs, funcInfo) {
    console.log(`Updating function ${inputs.name}'s code in ${this.region} ...`);
    const functionInputs = await formatFunctionInputs(this.region, inputs);
    const updateFunctionConnfigure = {
      Action: 'UpdateFunctionCode',
      Version: functionInputs.Version,
      Region: functionInputs.Region,
      Handler: functionInputs.Handler || funcInfo.Handler,
      FunctionName: functionInputs.FunctionName,
      CosBucketName: functionInputs['Code.CosBucketName'],
      CosObjectName: functionInputs['Code.CosObjectName'],
      Namespace: inputs.Namespace || funcInfo.Namespace,
    };
    const res = await this.scfClient.request(updateFunctionConnfigure);
    if (res.Response && res.Response.Error) {
      throw new TypeError(
        'API_SCF_UpdateFunctionCode',
        JSON.stringify(res.Response),
        null,
        res.Response.RequestId,
      );
    } else {
      return true;
    }
  }

  // update function configure
  async updatefunctionConfigure(inputs, funcInfo) {
    console.log(`Updating function ${inputs.name}'s configure in ${this.region} ...`);
    const functionInputs = await formatFunctionInputs(this.region, inputs);
    functionInputs.Action = 'UpdateFunctionConfiguration';
    functionInputs.Timeout = inputs.timeout || funcInfo.Timeout;
    functionInputs.Namespace = inputs.namespace || funcInfo.Namespace;
    functionInputs.MemorySize = inputs.memorySize || funcInfo.MemorySize;
    delete functionInputs['Handler'];
    delete functionInputs['Code.CosBucketName'];
    delete functionInputs['Code.CosObjectName'];
    delete functionInputs['CodeSource'];
    const res = await this.scfClient.request(functionInputs);
    if (res.Response && res.Response.Error) {
      throw new TypeError(
        'API_SCF_UpdateFunctionConfiguration',
        JSON.stringify(res.Response),
        null,
        res.Response.RequestId,
      );
    } else {
      return true;
    }
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
        console.log(`Deleting ${curTrigger.Type} triggers: ${curTrigger.TriggerName}.`);
        const delRes = await this.scfClient.request({
          Action: 'DeleteTrigger',
          Version: '2018-04-16',
          Region: this.region,
          FunctionName: funcInfo.FunctionName,
          Namespace: funcInfo.Namespace,
          Type: curTrigger.Type,
          TriggerDesc: curTrigger.TriggerDesc,
          TriggerName: curTrigger.TriggerName,
        });
        if (delRes.Response && delRes.Response.Error) {
          throw new TypeError(
            'API_SCF_DeleteTrigger',
            JSON.stringify(delRes.Response),
            null,
            delRes.Response.RequestId,
          );
        }
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
        const { Response } = await this.scfClient.request(triggerInputs);

        if (Response && Response.Error) {
          throw new TypeError(
            'API_SCF_CreateTrigger',
            JSON.stringify(Response),
            null,
            Response.RequestId,
          );
        }
        deployTriggerResult.push(Response.TriggerInfo);
      }
    }
    funcInfo.Triggers = deployTriggerResult;
    return deployTriggerResult;
  }

  // deploy tags
  async deployTags(funcInfo, inputs) {
    console.log(`Adding tags for function ${inputs.name} in ${this.region} ... `);
    const deleteTags = {};
    for (let i = 0; i < funcInfo.Tags.length; i++) {
      if (!inputs.tags.hasOwnProperty(funcInfo.Tags[i].Key)) {
        deleteTags[funcInfo.Tags[i].Key] = funcInfo.Tags[i].Value;
      }
    }
    const res = await this.tagClient.deploy({
      resource: `qcs::scf:${this.region}::lam/${funcInfo.FunctionId}`,
      replaceTags: inputs.tags,
      deleteTags: deleteTags,
    });

    if (res.Response && res.Response.Error) {
      throw new TypeError(
        'API_TAG_ModifyResourceTags',
        JSON.stringify(res.Response),
        null,
        res.Response.RequestId,
      );
    }
  }

  // 删除函数
  async deleteFunction(functionName, namespace) {
    const res = await this.scfClient.request({
      Action: 'DeleteFunction',
      Version: '2018-04-16',
      Region: this.region,
      FunctionName: functionName,
      Namespace: namespace || CONFIGS.defaultNamespace,
    });
    if (res.Response && res.Response.Error) {
      throw new TypeError(
        'API_SCF_DeleteFunction',
        JSON.stringify(res.Response),
        null,
        res.Response.RequestId,
      );
    }
  }

  /**
   * publish function version
   * @param {object} inputs publish version parameter
   */
  async publishVersion(inputs) {
    console.log(`Publish function ${inputs.functionName} version...`);
    const publishInputs = {
      Action: 'PublishVersion',
      Version: '2018-04-16',
      Region: inputs.region,
      FunctionName: inputs.functionName,
      Description: inputs.description || 'Published by Serverless Component',
      Namespace: inputs.namespace || 'default',
    };
    const res = await this.scfClient.request(publishInputs);

    if (res.Response && res.Response.Error) {
      throw new TypeError(
        'API_SCF_PublishVersion',
        JSON.stringify(res.Response),
        null,
        res.Response.RequestId,
      );
    }
    console.log(
      `Published function ${inputs.functionName} version ${res.Response.FunctionVersion}`,
    );
    return res.Response;
  }

  async publishVersionAndConfigTraffic(inputs) {
    const weight = strip(1 - inputs.traffic);
    const publishInputs = {
      Action: 'CreateAlias',
      Version: '2018-04-16',
      Region: inputs.region,
      FunctionName: inputs.functionName,
      FunctionVersion: inputs.functionVersion,
      Name: inputs.aliasName,
      Namespace: inputs.namespace || 'default',
      RoutingConfig: {
        AdditionalVersionWeights: [{ Version: inputs.functionVersion, Weight: weight }],
      },
      Description: inputs.description || 'Published by Serverless Component',
    };
    const res = await this.scfClient.request(publishInputs);
    if (res.Response && res.Response.Error) {
      throw new TypeError(
        'API_SCF_CreateAlias',
        JSON.stringify(res.Response),
        null,
        res.Response.RequestId,
      );
    }
    return res.Response;
  }

  async updateAliasTraffic(inputs) {
    const weight = strip(1 - inputs.traffic);
    console.log(
      `Config function ${inputs.functionName} traffic ${weight} for version ${inputs.lastVersion}...`,
    );
    const publishInputs = {
      Action: 'UpdateAlias',
      Version: '2018-04-16',
      Region: inputs.region,
      FunctionName: inputs.functionName,
      FunctionVersion: inputs.functionVersion || '$LATEST',
      Name: inputs.aliasName || '$DEFAULT',
      Namespace: inputs.namespace || 'default',
      RoutingConfig: {
        AdditionalVersionWeights: [{ Version: inputs.lastVersion, Weight: weight }],
      },
      Description: inputs.description || 'Configured by Serverless Component',
    };
    const res = await this.scfClient.request(publishInputs);
    if (res.Response && res.Response.Error) {
      throw new TypeError(
        'API_SCF_UpdateAlias',
        JSON.stringify(res.Response),
        null,
        res.Response.RequestId,
      );
    }
    console.log(
      `Config function ${inputs.functionName} traffic ${weight} for version ${inputs.lastVersion} success`,
    );
    return res.Response;
  }

  async getAlias(inputs) {
    const publishInputs = {
      Action: 'GetAlias',
      Version: '2018-04-16',
      Region: inputs.region,
      FunctionName: inputs.functionName,
      Name: inputs.functionVersion || '$DEFAULT',
      Namespace: inputs.namespace || 'default',
    };
    const res = await this.scfClient.request(publishInputs);
    if (res.Response && res.Response.Error) {
      throw new TypeError(
        'API_SCF_ListAliases',
        JSON.stringify(res.Response),
        null,
        res.Response.RequestId,
      );
    }
    return res.Response;
  }

  /**
   * check whether function status is operational
   * @param {string} namespace
   * @param {string} functionName funcitn name
   */
  async isOperationalStatus(namespace, functionName, qualifier = '$LATEST') {
    // after create/update function, should check function status is active, then continue
    const res = await this.checkStatus(namespace, functionName, qualifier);
    if (res === true) {
      return true;
    }
    throw new TypeError('API_SCF_isOperationalStatus', JSON.stringify(res), null, res.RequestId);
  }

  // deploy SCF flow
  async deploy(inputs = {}) {
    // whether auto create/bind role
    if (inputs.enableRoleAuth) {
      await this.bindScfQCSRole();
    }

    const namespace = inputs.namespace || CONFIGS.defaultNamespace;

    // check SCF exist
    // exist: update it, not: create it
    let funcInfo = await this.getFunction(namespace, inputs.name);
    if (!funcInfo) {
      await this.createFunction(inputs);
      funcInfo = await this.getFunction(namespace, inputs.name);
    } else {
      await this.updateFunctionCode(inputs, funcInfo);

      // should check function status is active, then continue
      await this.isOperationalStatus(namespace, inputs.name);

      await this.updatefunctionConfigure(inputs, funcInfo);

      // after updating function, get latest function info
      funcInfo = await this.getFunction(namespace, inputs.name);
    }

    // should check function status is active, then continue
    await this.isOperationalStatus(namespace, inputs.name);

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
    console.log(`Deleting function ${inputs.functionName || inputs.FunctionName} ...`);
    const functionName = inputs.functionName || inputs.FunctionName;
    const namespace = inputs.namespace || inputs.Namespace || CONFIGS.defaultNamespace;

    // check function exist, then delete
    const func = await this.getFunction(namespace, functionName);

    if (!func) {
      console.log(`Function ${functionName} not exist...`);
      return;
    }

    if (func.Status === 'Updating' || func.Status === 'Creating') {
      console.log(`Function ${functionName} status is ${func.Status}, can not delete...`);
      return;
    }

    await this.deleteFunction(functionName, namespace);

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

    console.log(`Removed function and triggers.`);
  }

  async invoke(functionName, inputs = {}) {
    const res = await this.scfClient.request({
      Action: 'Invoke',
      Version: '2018-04-16',
      Region: this.region,
      FunctionName: functionName,
      Namespace: inputs.namespace || CONFIGS.defaultNamespace,
      ClientContext: inputs.clientContext || {},
      LogType: inputs.logType || 'Tail',
      InvocationType: inputs.invocationType || 'RequestResponse',
    });
    if (res.Response && res.Response.Error) {
      throw new TypeError(
        'API_SCF_Invoke',
        JSON.stringify(res.Response),
        null,
        res.Response.RequestId,
      );
    }
    return res.Response;
  }
}

module.exports = Scf;
