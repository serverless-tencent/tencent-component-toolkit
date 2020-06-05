const { scf, cam } = require('tencent-cloud-sdk');
const TagsUtils = require('../tag/index');
const ApigwUtils = require('../apigw/index');

// 默认变量
const defaultNamespace = 'default';
const defaultMemorySize = 128;
const defaultTimeout = 3;

class Scf {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.scfClient = new scf(this.credentials);
    this.tagClient = new TagsUtils(this.credentials, this.region);
    this.apigwClient = new ApigwUtils(this.credentials, this.region);
  }

  async sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  // 函数配置转换
  async getFunctionConfigure(inputs) {
    // 固定参数&必须参数
    console.log(`Getting function ${inputs.name}'s configure ...`);
    const functionConfigure = {
      Version: '2018-04-16',
      Region: this.region,
      FunctionName: inputs.name,
      'Code.CosBucketName': inputs.code.bucket,
      'Code.CosObjectName': inputs.code.object,
      Handler: inputs.handler,
      Runtime: inputs.runtime,
      Timeout: inputs.timeout || defaultTimeout,
      Namespace: inputs.namespace || defaultNamespace,
      MemorySize: inputs.memorySize || defaultMemorySize,
      CodeSource: 'Cos',
    };

    // 非必须参数
    if (inputs.role) {
      functionConfigure.Role = inputs.role;
    }
    if (inputs.description) {
      functionConfigure.Description = inputs.description;
    }
    if (inputs.cls) {
      if (inputs.cls.logsetId) {
        functionConfigure.ClsLogsetId = inputs.cls.logsetId;
      }
      if (inputs.cls.topicId) {
        functionConfigure.ClsTopicId = inputs.cls.topicId;
      }
    }
    if (inputs.environment && inputs.environment.variables) {
      let index = 0;
      for (const item in inputs.environment.variables) {
        functionConfigure[`Environment.Variables.${index}.Key`] = item;
        functionConfigure[`Environment.Variables.${index}.Value`] =
          inputs.environment.variables[item];
        index++;
      }
    }
    if (inputs.vpcConfig) {
      if (inputs.vpcConfig.vpcId) {
        functionConfigure['VpcConfig.VpcId'] = inputs.vpcConfig.vpcId;
      }
      if (inputs.vpcConfig.subnetId) {
        functionConfigure['VpcConfig.SubnetId'] = inputs.vpcConfig.subnetId;
      }
    }
    functionConfigure['EipConfig.EipFixed'] = inputs.eip === true ? 'TRUE' : 'FALSE';
    if (inputs.layers) {
      inputs.layers.forEach((item, index) => {
        functionConfigure[`Layers.${index}.LayerName`] = item.name;
        functionConfigure[`Layers.${index}.LayerVersion`] = item.version;
      });
    }
    if (inputs.deadLetter) {
      if (inputs.deadLetter.type) {
        functionConfigure['DeadLetterConfig.Type'] = inputs.deadLetter.type;
      }
      if (inputs.deadLetter.name) {
        functionConfigure['DeadLetterConfig.Name'] = inputs.deadLetter.name;
      }
      if (inputs.deadLetter.filterType) {
        functionConfigure['DeadLetterConfig.FilterType'] = inputs.deadLetter.filterType;
      }
    }
    return functionConfigure;
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

  // 获取函数信息
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
        throw new Error(JSON.stringify(funcInfo.Response));
      } else {
        return funcInfo.Response;
      }
    } catch (e) {
      throw e;
    }
  }

  // 检查函数状态，目前函数是异步操作，所以此处需要对状态进行检测
  async checkStatus(namespace, functionName) {
    console.log(`Checking function ${functionName} status ...`);
    let status = 'Updating';
    let times = 200;
    while ((status == 'Updating' || status == 'Creating') && times > 0) {
      const tempFunc = await this.getFunction(namespace, functionName);
      status = tempFunc.Status;
      await this.sleep(300);
      times = times - 1;
    }
    return status != 'Active' ? false : true;
  }

  // 创建函数
  async createFunction(inputs) {
    console.log(`Creating funtion ${inputs.name} in ${this.region} ... `);
    const functionConfigure = await this.getFunctionConfigure(inputs);
    functionConfigure.Action = 'CreateFunction';
    const funcInfo = await this.scfClient.request(functionConfigure);
    if (funcInfo.Response && funcInfo.Response.Error) {
      throw new Error(JSON.stringify(funcInfo.Response));
    } else {
      return true;
    }
  }

  // 更新函数代码
  async updateFunctionCode(inputs, funcInfo) {
    console.log(`Updating funtion ${inputs.name}'s code in ${this.region} ...`);
    const functionConfigure = await this.getFunctionConfigure(inputs);
    const updateFunctionConnfigure = {
      Action: 'UpdateFunctionCode',
      Version: functionConfigure.Version,
      Region: functionConfigure.Region,
      Handler: inputs.Handler || funcInfo.Handler,
      FunctionName: functionConfigure.FunctionName,
      CosBucketName: functionConfigure['Code.CosBucketName'],
      CosObjectName: functionConfigure['Code.CosObjectName'],
      Namespace: inputs.Namespace || funcInfo.Namespace,
    };
    const updateFunctionCodeResult = await this.scfClient.request(updateFunctionConnfigure);
    if (updateFunctionCodeResult.Response && updateFunctionCodeResult.Response.Error) {
      throw new Error(JSON.stringify(updateFunctionCodeResult.Response));
    } else {
      return true;
    }
  }

  // 更新函数配置
  async updateFunctionConfigure(inputs, funcInfo) {
    console.log(`Updating funtion ${inputs.name}'s configure in ${this.region} ...`);
    const functionConfigure = await this.getFunctionConfigure(inputs);
    functionConfigure.Action = 'UpdateFunctionConfiguration';
    functionConfigure.Timeout = inputs.timeout || funcInfo.Timeout;
    functionConfigure.Namespace = inputs.namespace || funcInfo.Namespace;
    functionConfigure.MemorySize = inputs.memorySize || funcInfo.MemorySize;
    delete functionConfigure['Handler'];
    delete functionConfigure['Code.CosBucketName'];
    delete functionConfigure['Code.CosObjectName'];
    delete functionConfigure['CodeSource'];
    const updateFunctionCodeResult = await this.scfClient.request(functionConfigure);
    if (updateFunctionCodeResult.Response && updateFunctionCodeResult.Response.Error) {
      throw new Error(JSON.stringify(updateFunctionCodeResult.Response));
    } else {
      return true;
    }
  }

  // 部署触发器
  async deployTrigger(funcInfo, inputs) {
    if (inputs.events) {
      console.log(`Deploying ${inputs.name}'s triggers in ${this.region}.`);

      if ((await this.checkStatus(inputs.namespace || defaultNamespace, inputs.name)) == false) {
        throw new Error(`Deploying ${inputs.name} trigger failed. Please check function status.`);
      }

      const releaseEvents = funcInfo.Triggers;
      const releaseEventsObj = {};
      for (let i = 0; i < releaseEvents.length; i++) {
        const thisTrigger = releaseEvents[i];
        if (thisTrigger.Type == 'cos') {
          console.log(thisTrigger);
          releaseEventsObj[
            `cos-${thisTrigger.TriggerName}-${thisTrigger.TriggerDesc}`
          ] = thisTrigger;
        } else if (thisTrigger.Type != 'apigw') {
          releaseEventsObj[`${thisTrigger.Type}-${thisTrigger.TriggerName}`] = thisTrigger;
        }
      }
      const deployTriggerResult = [];
      for (let i = 0; i < inputs.events.length; i++) {
        let deployThisTriggerResult;
        const trigger = {
          Action: 'CreateTrigger',
          Version: '2018-04-16',
          Region: this.region,
          FunctionName: funcInfo.FunctionName,
          Namespace: funcInfo.Namespace,
        };
        const event = inputs.events[i];
        const eventType = Object.keys(event)[0];

        if (eventType === 'apigw') {
          const thisTrigger = inputs.events[i]['apigw']['parameters'];
          thisTrigger.region = this.region;
          thisTrigger.serviceName = thisTrigger.serviceName || inputs.events[i]['apigw']['name'];
          thisTrigger.endpoints = thisTrigger.endpoints.map((endpoint) => {
            endpoint.function = endpoint.function || {};
            endpoint.function.functionName = funcInfo.FunctionName;
            endpoint.function.functionNamespace = funcInfo.Namespace;
            return endpoint;
          });
          try {
            deployThisTriggerResult = await this.apigwClient.deploy(thisTrigger);
          } catch (e) {
            throw e;
          }
        } else {
          let triggerUnikey;
          if (eventType === 'timer') {
            const thisTrigger = inputs.events[i]['timer'];
            trigger.Type = 'timer';
            trigger.TriggerName = thisTrigger['name'];
            trigger.TriggerDesc = thisTrigger['parameters']['cronExpression'];
            trigger.Enable = thisTrigger['parameters']['enable'] ? 'OPEN' : 'CLOSE';
            if (thisTrigger['parameters']['argument']) {
              trigger.CustomArgument = thisTrigger['parameters']['argument'];
            }
            triggerUnikey = `${trigger.Type}-${trigger.TriggerName}`;
          } else if (eventType === 'cos') {
            const thisTrigger = inputs.events[i]['cos'];
            trigger.Type = 'cos';
            trigger.TriggerName = thisTrigger['parameters']['bucket'];
            trigger.TriggerDesc = JSON.stringify({
              event: thisTrigger['parameters']['events'],
              filter: {
                Prefix:
                  thisTrigger['parameters']['filter'] &&
                  thisTrigger['parameters']['filter']['prefix']
                    ? thisTrigger['parameters']['filter']['prefix']
                    : String(''),
                Suffix:
                  thisTrigger['parameters']['filter'] &&
                  thisTrigger['parameters']['filter']['suffix']
                    ? thisTrigger['parameters']['filter']['suffix']
                    : String(''),
              },
            });
            trigger.Enable = inputs.events[i]['cos']['parameters']['enable'] ? 'OPEN' : 'CLOSE';
            const tempDest = JSON.stringify({
              bucketUrl: trigger.TriggerName,
              event: JSON.parse(trigger.TriggerDesc).event,
              filter: JSON.parse(trigger.TriggerDesc).filter,
            });
            triggerUnikey = `cos-${trigger.TriggerName}-${tempDest}`;
          } else if (eventType === 'ckafka') {
            const thisTrigger = inputs.events[i]['ckafka'];
            trigger.Type = 'ckafka';
            trigger.TriggerName = `${thisTrigger['parameters']['name']}-${thisTrigger['parameters']['topic']}`;
            trigger.TriggerDesc = JSON.stringify({
              maxMsgNum: thisTrigger['parameters']['maxMsgNum'],
              offset: thisTrigger['parameters']['offset'],
            });
            trigger.Enable = thisTrigger['parameters']['enable'] ? 'OPEN' : 'CLOSE';
            triggerUnikey = `${trigger.Type}-${trigger.TriggerName}`;
          } else if (eventType === 'cmq') {
            const thisTrigger = inputs.events[i]['cmq'];
            trigger.Type = 'cmq';
            trigger.TriggerName = thisTrigger['parameters']['name'];
            trigger.TriggerDesc = JSON.stringify({
              filterType: 1,
              filterKey: thisTrigger['parameters']['filterKey'],
            });
            trigger.Enable = thisTrigger['parameters']['enable'] ? 'OPEN' : 'CLOSE';
            triggerUnikey = `${trigger.Type}-${trigger.TriggerName}`;
          }

          // 检查函数状态
          const functionStatus = await this.checkStatus(
            inputs.namespace || defaultNamespace,
            inputs.name,
          );
          if (functionStatus == false) {
            throw new Error(
              `Function ${inputs.name} deploy trigger failed. Please check function status.`,
            );
          }

          // 判断Trigger是否已经存在
          let deploy = false;

          if (releaseEventsObj[triggerUnikey]) {
            // 存在Trigger
            // 判断Trigger是否一致，如果一致跳过，否则删除重
            const thisReleaseTrigger = releaseEventsObj[triggerUnikey];
            for (const item in thisReleaseTrigger) {
              if (['TriggerDesc', 'TriggerName', 'Enable', 'CustomArgument'].includes(item)) {
                if (trigger[item] && trigger[item] != thisReleaseTrigger[item]) {
                  deploy = true;
                  break;
                }
                if (trigger[item] == undefined && thisReleaseTrigger[item].length != 0) {
                  deploy = true;
                  break;
                }
              }
            }

            // 需要重新部署的触发器，需要先删除，再部署
            if (deploy) {
              console.log(
                `Changing ${eventType} triggers: ${inputs.events[i][eventType]['name']}.`,
              );
              const deleteThisTriggerResult = await this.scfClient.request({
                Action: 'DeleteTrigger',
                Version: '2018-04-16',
                Region: this.region,
                FunctionName: funcInfo.FunctionName,
                Namespace: funcInfo.Namespace,
                Type: thisReleaseTrigger.Type,
                TriggerDesc: thisReleaseTrigger.TriggerDesc,
                TriggerName: thisReleaseTrigger.TriggerName,
              });
              if (deleteThisTriggerResult.Response && deleteThisTriggerResult.Response.Error) {
                throw new Error(JSON.stringify(deleteThisTriggerResult.Response));
              }
            }
          } else {
            deploy = true;
          }

          if (deploy) {
            console.log(`Deploying ${eventType} triggers: ${inputs.events[i][eventType]['name']}.`);
            deployThisTriggerResult = await this.scfClient.request(trigger);
            if (deployThisTriggerResult.Response && deployThisTriggerResult.Response.Error) {
              throw new Error(JSON.stringify(deployThisTriggerResult.Response));
            }
          }
        }
        deployTriggerResult.push(deployThisTriggerResult);
      }
      funcInfo.Triggers = deployTriggerResult;
      return deployTriggerResult;
    }
  }

  // 部署标签
  async deployTags(funcInfo, inputs) {
    if (inputs.tags) {
      console.log(`Adding tags for funtion ${inputs.name} in ${this.region} ... `);
      const deleteTags = {};
      for (let i = 0; i < funcInfo.Tags.length; i++) {
        if (!inputs.tags.hasOwnProperty(funcInfo.Tags[i].Key)) {
          deleteTags[funcInfo.Tags[i].Key] = funcInfo.Tags[i].Value;
        }
      }
      const addTagsResult = await this.tagClient.deploy({
        resource: `qcs::scf:${this.region}::lam/${funcInfo.FunctionId}`,
        replaceTags: inputs.tags,
        deleteTags: deleteTags,
      });

      if (addTagsResult.Response && addTagsResult.Response.Error) {
        throw new Error(JSON.stringify(addTagsResult.Response));
      }
    }
  }

  // 删除函数
  async deleteFunction(functionName, namespace) {
    const deleteFunctionResult = await this.scfClient.request({
      Action: 'DeleteFunction',
      Version: '2018-04-16',
      Region: this.region,
      FunctionName: functionName,
      Namespace: namespace || defaultNamespace,
    });
    if (deleteFunctionResult.Response && deleteFunctionResult.Response.Error) {
      throw new Error(JSON.stringify(deleteFunctionResult.Response));
    }
  }

  // 删除API网关
  async deleteAPIGW(service) {
    await this.apigwClient.remove(service);
  }

  // 部署函数的主逻辑
  async deploy(inputs = {}) {
    // 新增role

    if (inputs.enableRoleAuth) {
      await this.bindScfQCSRole();
    }

    // 判断函数是否存在
    // 已存在，进行更新操作，不存在进行创建操作
    let funcInfo = await this.getFunction(inputs.namespace || defaultNamespace, inputs.name);
    if (!funcInfo) {
      await this.createFunction(inputs);
    } else {
      await this.updateFunctionCode(inputs, funcInfo);
      if ((await this.checkStatus(inputs.namespace || defaultNamespace, inputs.name)) == false) {
        throw new Error(`Function ${inputs.name} upgrade failed. Please check function status.`);
      }
      await this.updateFunctionConfigure(inputs, funcInfo);
    }

    // 对非必要流程进行额外处理
    if (!funcInfo) {
      funcInfo = await this.getFunction(inputs.namespace || defaultNamespace, inputs.name);
    }
    const output = funcInfo;
    if (inputs.tags || inputs.events) {
      if (!funcInfo) {
        funcInfo = await this.getFunction(inputs.namespace || defaultNamespace, inputs.name);
      }
      if ((await this.checkStatus(inputs.namespace || defaultNamespace, inputs.name)) == false) {
        throw new Error(`Function ${inputs.name} upgrade failed. Please check function status.`);
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
    const namespace = inputs.namespace || inputs.Namespace || defaultNamespace;

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
            await this.deleteAPIGW(inputs.Triggers[i]);
          } catch (e) {
            console.log(e);
          }
        }
      }
    }

    console.log(`Removed function and triggers.`);
  }

  async invoke(functionName, configure = {}) {
    const invokeFunctionResult = await this.scfClient.request({
      Action: 'Invoke',
      Version: '2018-04-16',
      Region: this.region,
      FunctionName: functionName,
      Namespace: configure.namespace || defaultNamespace,
      ClientContext: configure.clientContext || {},
      LogType: configure.logType || 'Tail',
      InvocationType: configure.invocationType || 'RequestResponse',
    });
    if (invokeFunctionResult.Response && invokeFunctionResult.Response.Error) {
      throw new Error(JSON.stringify(invokeFunctionResult.Response));
    }
    return invokeFunctionResult.Response;
  }
}

module.exports = Scf;
