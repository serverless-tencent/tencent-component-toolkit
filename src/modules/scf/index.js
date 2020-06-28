const { scf, cam } = require('tencent-cloud-sdk');
const { sleep } = require('@ygkit/request');
const { TypeError } = require('../../utils/error');
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
  async getFunction(namespace, functionName, showCode) {
    try {
      const funcInfo = await this.scfClient.request({
        Action: 'GetFunction',
        Version: '2018-04-16',
        Region: this.region,
        FunctionName: functionName,
        Namespace: namespace,
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
  // because craeting function is asynchronous
  async checkStatus(namespace, functionName) {
    console.log(`Checking function ${functionName} status ...`);
    let status = 'Updating';
    let times = 200;
    while ((status == 'Updating' || status == 'Creating') && times > 0) {
      const tempFunc = await this.getFunction(namespace, functionName);
      status = tempFunc.Status;
      await sleep(300);
      times = times - 1;
    }
    return status !== 'Active' ? false : true;
  }

  // create function
  async createFunction(inputs) {
    console.log(`Creating funtion ${inputs.name} in ${this.region} ... `);
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
    console.log(`Updating funtion ${inputs.name}'s code in ${this.region} ...`);
    const functionInputs = await formatFunctionInputs(this.region, inputs);
    const updateFunctionConnfigure = {
      Action: 'UpdateFunctionCode',
      Version: functionInputs.Version,
      Region: functionInputs.Region,
      Handler: inputs.Handler || funcInfo.Handler,
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
    console.log(`Updating funtion ${inputs.name}'s configure in ${this.region} ...`);
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
    if (inputs.events) {
      console.log(`Deploying ${inputs.name}'s triggers in ${this.region}.`);

      // check function status, if is Active, so we can continue to create trigger for it
      const functionStatus = await this.checkStatus(
        inputs.namespace || CONFIGS.defaultNamespace,
        inputs.name,
      );
      if (functionStatus === false) {
        throw new TypeError(
          'API_SCF_GetFunction_STATUS',
          `Function ${inputs.name} deploy trigger failed. Please check function status.`,
        );
      }

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
          );
          try {
            const apigwOutput = await this.apigwClient.deploy(triggerInputs);

            deployTriggerResult.push(apigwOutput);
          } catch (e) {
            throw e;
          }
        } else {
          const { triggerInputs } = formatTrigger(
            eventType,
            this.region,
            funcInfo,
            event[eventType],
          );

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
  }

  // deploy tags
  async deployTags(funcInfo, inputs) {
    if (inputs.tags) {
      console.log(`Adding tags for funtion ${inputs.name} in ${this.region} ... `);
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
    return res.Response;
  }

  async publishVersionAndConfigTraffic(inputs) {
    const publishInputs = {
      Action: 'CreateAlias',
      Version: '2018-04-16',
      Region: inputs.region,
      FunctionName: inputs.functionName,
      FunctionVersion: inputs.functionVersion,
      Name: inputs.aliasName,
      Namespace: inputs.namespace || 'default',
      RoutingConfig: {
        AdditionalVersionWeights: [{ Version: inputs.functionVersion, Weight: 1 - inputs.traffic }],
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
    const publishInputs = {
      Action: 'UpdateAlias',
      Version: '2018-04-16',
      Region: inputs.region,
      FunctionName: inputs.functionName,
      FunctionVersion: inputs.functionVersion || '$LATEST',
      Name: inputs.aliasName || '$DEFAULT',
      Namespace: inputs.namespace || 'default',
      RoutingConfig: {
        AdditionalVersionWeights: [{ Version: inputs.lastVersion, Weight: 1 - inputs.traffic }],
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
    return res.Response;
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
      const functionStatus = await this.checkStatus(namespace, inputs.name);
      if (functionStatus === false) {
        throw new TypeError(
          'API_SCF_GetFunction_STATUS',
          `Function ${inputs.name} upgrade failed. Please check function status.`,
        );
      }
      await this.updatefunctionConfigure(inputs, funcInfo);
    }

    const output = funcInfo;
    if (inputs.tags || inputs.events) {
      if (!funcInfo) {
        funcInfo = await this.getFunction(namespace, inputs.name);
      }
      if ((await this.checkStatus(namespace, inputs.name)) === false) {
        throw new TypeError(
          'API_SCF_GetFunction_STATUS',
          `Function ${inputs.name} upgrade failed. Please check function status.`,
        );
      }
      await Promise.all([this.deployTags(funcInfo, inputs), this.deployTrigger(funcInfo, inputs)]);
    }

    console.log(`Deployed funtion ${funcInfo.FunctionName}.`);
    return output;
  }

  // 移除函数的主逻辑
  async remove(inputs = {}) {
    console.log(`Deleteing function ${inputs.functionName || inputs.FunctionName} ...`);
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
