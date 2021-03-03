import { ActionType } from './apis';
import { RegionType, ApiServiceType, CapiCredentials } from './../interface';
import { sleep, waitResponse } from '@ygkit/request';
import { Capi } from '@tencent-sdk/capi';
import { ApiTypeError, ApiError } from '../../utils/error';
import { deepClone, strip } from '../../utils';
import TagsUtils from '../tag/index';
import ApigwUtils from '../apigw';
import Cam from '../cam/index';
import { formatFunctionInputs } from './utils';
import CONFIGS from './config';
import APIS from './apis';
import TRIGGERS from '../triggers';
import BaseTrigger, { CAN_UPDATE_TRIGGER } from '../triggers/base';
import {
  ScfCreateFunctionInputs,
  FunctionInfo,
  TriggerType,
  ScfDeployInputs,
  ScfRemoveInputs,
  ScfInvokeInputs,
  ScfDeployTriggersInputs,
  ScfPublishVersionInputs,
  publishVersionAndConfigTraffic,
  ScfUpdateAliasInputs,
  ScfCreateAlias,
  ScfGetAliasInputs,
  ScfDeleteAliasInputs,
  ScfListAliasInputs,
  ScfUpdateAliasTrafficInputs,
  ScfDeployOutputs,
  OriginTriggerType,
} from './interface';

/** 云函数组件 */
export default class Scf {
  tagClient: TagsUtils;
  apigwClient: ApigwUtils;
  capi: Capi;
  region: RegionType;
  credentials: CapiCredentials;

  constructor(credentials = {}, region: RegionType = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;
    this.tagClient = new TagsUtils(this.credentials, this.region);
    this.apigwClient = new ApigwUtils(this.credentials, this.region);

    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.scf,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, data);
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
  async getFunction(
    namespace: string,
    functionName: string,
    qualifier = '$LATEST',
    showCode = false,
  ) {
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
  // if not become Active in 240 * 500 miniseconds, return request result, and throw error
  async checkStatus(namespace = 'default', functionName: string, qualifier = '$LATEST') {
    let initialInfo = await this.getFunction(namespace, functionName, qualifier);
    let { Status } = initialInfo;
    let times = 240;
    while (CONFIGS.waitStatus.indexOf(Status) !== -1 && times > 0) {
      initialInfo = await this.getFunction(namespace, functionName, qualifier);
      if (!initialInfo) {
        return {
          isOperational: true,
          detail: initialInfo,
        };
      }
      ({ Status } = initialInfo);
      // if change to failed status break loop
      if (CONFIGS.failStatus.indexOf(Status) !== -1) {
        break;
      }
      await sleep(500);
      times = times - 1;
    }
    const { StatusReasons } = initialInfo;
    return Status !== 'Active'
      ? {
          isOperational: false,
          detail: initialInfo,
          error: {
            message:
              StatusReasons && StatusReasons.length > 0
                ? `函数状态异常, ${StatusReasons[0].ErrorMessage}`
                : `函数状态异常, ${Status}`,
          },
        }
      : {
          isOperational: true,
          detail: initialInfo,
        };
  }

  // create function
  async createFunction(inputs: ScfCreateFunctionInputs) {
    console.log(`Creating function ${inputs.name} in ${this.region}`);
    const inp = formatFunctionInputs(this.region, inputs);
    const functionInputs = { Action: 'CreateFunction' as const, ...inp };
    await this.request(functionInputs);
    return true;
  }

  // update function code
  async updateFunctionCode(inputs: ScfCreateFunctionInputs, funcInfo: FunctionInfo) {
    console.log(`Updating function ${inputs.name} code in ${this.region}`);
    const functionInputs = await formatFunctionInputs(this.region, inputs);
    const updateFunctionConnfigure = {
      Action: 'UpdateFunctionCode' as const,
      Handler: functionInputs.Handler || funcInfo.Handler,
      FunctionName: functionInputs.FunctionName,
      CosBucketName: functionInputs.Code?.CosBucketName,
      CosObjectName: functionInputs.Code?.CosObjectName,
      Namespace: inputs.namespace || funcInfo.Namespace,
    };
    await this.request(updateFunctionConnfigure);
    return true;
  }

  // update function configure
  async updatefunctionConfigure(inputs: ScfCreateFunctionInputs, funcInfo: FunctionInfo) {
    console.log(`Updating function ${inputs.name} configure in ${this.region}`);
    let tmpInputs = await formatFunctionInputs(this.region, inputs);

    tmpInputs = {
      ...tmpInputs,
      Timeout: inputs.timeout || funcInfo.Timeout,
      Namespace: inputs.namespace || funcInfo.Namespace,
      MemorySize: inputs.memorySize || funcInfo.MemorySize,
    };
    if (!tmpInputs.ClsLogsetId) {
      tmpInputs.ClsLogsetId = '';
      tmpInputs.ClsTopicId = '';
    }

    const reqInputs: Partial<typeof tmpInputs> = tmpInputs;

    // can not update handler,code,codesource
    delete reqInputs.Handler;
    delete reqInputs.Code;
    delete reqInputs.CodeSource;
    delete reqInputs.AsyncRunEnable;

    // +++++++++++++++++++++++
    // Below are very strange logical for layer unbind, but backend api need me to do this.
    // handle unbind one layer
    if (reqInputs.Layers && reqInputs.Layers.length === 0) {
      reqInputs.Layers.push({
        LayerName: '',
        LayerVersion: 0,
      });
    }
    // handler empty environment variables
    if (!reqInputs?.Environment?.Variables || reqInputs.Environment.Variables.length === 0) {
      reqInputs.Environment = { Variables: [{ Key: '', Value: '' }] };
    }
    await this.request({ Action: 'UpdateFunctionConfiguration', ...reqInputs });
    return true;
  }

  async getTriggerList(functionName: string, namespace = 'default'): Promise<TriggerType[]> {
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

  filterTriggers(funcInfo: FunctionInfo, events: OriginTriggerType[], oldList: TriggerType[]) {
    const deleteList: (TriggerType | null)[] = deepClone(oldList);
    const createList: (OriginTriggerType | null)[] = deepClone(events);
    const deployList: (TriggerType | null)[] = [];
    // const noKeyTypes = ['apigw'];
    const updateList: (OriginTriggerType | null)[] = [];

    events.forEach((event, index) => {
      const Type = Object.keys(event)[0];
      const TriggerClass = TRIGGERS[Type];
      const triggerInstance: BaseTrigger = new TriggerClass({
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
      deployList[index] = {
        NeedCreate: true,
        Type,
        ...event[Type],
      };

      // FIXME: 逻辑较乱
      for (let i = 0; i < oldList.length; i++) {
        const oldTrigger = oldList[i];
        if (oldTrigger.Type !== Type) {
          continue;
        }
        const OldTriggerClass = TRIGGERS[oldTrigger.Type];
        const oldTriggerInstance = new OldTriggerClass({
          credentials: this.credentials,
          region: this.region,
        });
        const oldKey = oldTriggerInstance.getKey(oldTrigger);

        if (oldKey !== triggerKey) {
          deployList[index] = {
            NeedCreate: true,
            Type,
            ...event[Type],
          };

          continue;
        }

        deleteList[i] = null;
        updateList.push(createList[index]);
        if (CAN_UPDATE_TRIGGER.indexOf(Type) === -1) {
          createList[index] = null;
          deployList[index] = {
            NeedCreate: false,
            ...oldTrigger,
          };
        } else {
          deployList[index] = {
            NeedCreate: true,
            Type,
            ...event[Type],
          };
        }
      }
    });
    return {
      updateList,
      deleteList: deleteList.filter((item) => item),
      createList: createList.filter((item) => item),
      deployList,
    };
  }

  // deploy SCF triggers
  async deployTrigger(funcInfo: FunctionInfo, inputs: ScfDeployTriggersInputs) {
    console.log(`Deploying triggers for function ${funcInfo.FunctionName}`);

    // should check function status is active, then continue
    await this.isOperationalStatus(inputs.namespace, inputs.name!);

    // get all triggers
    const triggerList = await this.getTriggerList(funcInfo.FunctionName, funcInfo.Namespace);

    const { deleteList, deployList } = this.filterTriggers(funcInfo, inputs.events!, triggerList);

    // remove all old triggers
    for (let i = 0, len = deleteList.length; i < len; i++) {
      const trigger = deleteList[i];
      const { Type } = trigger!;
      const TriggerClass = TRIGGERS[Type];

      if (TriggerClass) {
        const triggerInstance = new TriggerClass({
          credentials: this.credentials,
          region: this.region,
        });
        await triggerInstance.delete({
          scf: this,
          region: this.region,
          inputs: {
            namespace: funcInfo.Namespace,
            functionName: funcInfo.FunctionName,
            type: trigger?.Type,
            triggerDesc: trigger?.TriggerDesc,
            triggerName: trigger?.TriggerName,
            qualifier: trigger?.Qualifier,
          },
        });
      }
    }

    // create all new triggers
    for (let i = 0; i < deployList.length; i++) {
      const trigger = deployList[i];
      const { Type } = trigger!;
      if (trigger?.NeedCreate === true) {
        const TriggerClass = TRIGGERS[Type];
        if (!TriggerClass) {
          throw new ApiTypeError('PARAMETER_SCF', `Unknow trigger type ${Type}`);
        }
        const triggerInstance = new TriggerClass({
          credentials: this.credentials,
          region: this.region,
        });
        const triggerOutput = await triggerInstance.create({
          scf: this,
          region: this.region,
          inputs: {
            namespace: funcInfo.Namespace,
            functionName: funcInfo.FunctionName,
            ...trigger,
          },
        });

        deployList[i] = {
          NeedCreate: trigger?.NeedCreate,
          ...triggerOutput,
        };
      }
    }
    return deployList;
  }

  // delete function
  async deleteFunction(namespace: string, functionName: string) {
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
  async publishVersion(inputs: ScfPublishVersionInputs = {}) {
    console.log(`Publishing function ${inputs.functionName} version`);
    const publishInputs = {
      Action: 'PublishVersion' as const,
      FunctionName: inputs.functionName,
      Description: inputs.description || 'Published by Serverless Component',
      Namespace: inputs.namespace || 'default',
    };
    const Response = await this.request(publishInputs);

    console.log(`Published function ${inputs.functionName} version ${Response.FunctionVersion}`);
    return Response;
  }

  async publishVersionAndConfigTraffic(inputs: publishVersionAndConfigTraffic) {
    const weight = strip(1 - inputs.traffic);
    const publishInputs = {
      Action: 'CreateAlias' as const,
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

  async updateAliasTraffic(inputs: ScfUpdateAliasTrafficInputs) {
    const weight = strip(1 - inputs.traffic);
    console.log(
      `Config function ${inputs.functionName} traffic ${weight} for version ${inputs.lastVersion}`,
    );
    const publishInputs = {
      Action: 'UpdateAlias' as const,
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

  async createAlias(inputs: ScfCreateAlias) {
    const publishInputs = {
      Action: 'CreateAlias' as const,
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

  async updateAlias(inputs: ScfUpdateAliasInputs) {
    console.log(
      `Config function ${inputs.functionName} traffic ${inputs.traffic} for version ${inputs.lastVersion}`,
    );
    const publishInputs = {
      Action: 'UpdateAlias' as const,
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

  async getAlias(inputs: ScfGetAliasInputs) {
    const publishInputs = {
      Action: 'GetAlias' as const,
      FunctionName: inputs.functionName,
      Name: inputs.aliasName || '$DEFAULT',
      Namespace: inputs.namespace || 'default',
    };
    const Response = await this.request(publishInputs);
    return Response;
  }

  async deleteAlias(inputs: ScfDeleteAliasInputs) {
    const publishInputs = {
      Action: 'DeleteAlias' as const,
      FunctionName: inputs.functionName,
      Name: inputs.aliasName || '$DEFAULT',
      Namespace: inputs.namespace || 'default',
    };
    const Response = await this.request(publishInputs);
    return Response;
  }

  async listAlias(inputs: ScfListAliasInputs) {
    const publishInputs = {
      Action: 'ListAliases' as const,
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
  async isOperationalStatus(
    namespace: string | undefined,
    functionName: string,
    qualifier = '$LATEST',
  ) {
    // after create/update function, should check function status is active, then continue
    const { isOperational, detail, error } = await this.checkStatus(
      namespace,
      functionName,
      qualifier,
    );
    if (isOperational === true) {
      return detail;
    }
    if (error) {
      throw new ApiTypeError('API_SCF_isOperationalStatus', error?.message);
    }
    return detail;
  }

  async tryToDeleteFunction(namespace: string, functionName: string) {
    try {
      console.log(`正在尝试删除创建失败的函数，命令空间：${namespace}，函数名称：${functionName}`);
      await this.deleteFunction(namespace, functionName);
      await this.isOperationalStatus(namespace, functionName);
    } catch (e) {}
  }

  // check whether scf is operational
  async isOperational(namespace: string, functionName: string, qualifier = '$LATEST') {
    const funcInfo = await this.getFunction(namespace, functionName, qualifier);
    if (funcInfo) {
      const { Status, StatusReasons } = funcInfo;
      const reason = StatusReasons && StatusReasons.length > 0 ? StatusReasons[0].ErrorMessage : '';
      if (Status === 'Active') {
        return funcInfo;
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
          return null;
        case 'DeleteFailed':
          errorMsg = `函数删除失败，${reason || Status}`;
          break;
      }
      if (errorMsg) {
        throw new ApiTypeError('API_SCF_isOperational', errorMsg);
      }
    }

    return funcInfo;
  }

  // deploy SCF flow
  async deploy(inputs: ScfDeployInputs = {}): Promise<ScfDeployOutputs> {
    const namespace = inputs.namespace ?? CONFIGS.defaultNamespace;

    // before deploy a scf, we should check whether
    // if is CreateFailed, try to remove it
    let funcInfo = await this.isOperational(namespace, inputs.name!);

    // check SCF exist
    // exist: update it, not: create it
    if (!funcInfo) {
      await this.createFunction(inputs);
    } else {
      await this.updateFunctionCode(inputs, funcInfo);

      // should check function status is active, then continue
      await this.isOperationalStatus(namespace, inputs.name!);

      await this.updatefunctionConfigure(inputs, funcInfo);
    }

    // should check function status is active, then continue
    funcInfo = await this.isOperationalStatus(namespace, inputs.name!);

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
      await this.isOperationalStatus(namespace, inputs.name!, inputs.lastVersion);
    }

    const needSetTraffic =
      inputs.traffic != null && inputs.lastVersion && inputs.lastVersion !== '$LATEST';
    if (needSetTraffic) {
      await this.updateAliasTraffic({
        namespace,
        functionName: funcInfo.FunctionName,
        region: this.region,
        traffic: inputs.traffic!,
        lastVersion: inputs.lastVersion!,
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
        weights.forEach((w: { Version: number; Weight: number }) => {
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
        serviceType: ApiServiceType.scf,
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

  /**
   * 移除函数的主逻辑
   */
  async remove(inputs: ScfRemoveInputs = {}) {
    const functionName: string = inputs.functionName ?? inputs.FunctionName!;
    console.log(`Removing function ${functionName}`);
    const namespace = inputs.namespace ?? inputs.Namespace ?? CONFIGS.defaultNamespace;

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
            curTrigger.isRemoveTrigger = true;
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

  async invoke(inputs: ScfInvokeInputs = {} as any) {
    const Response = await this.request({
      Action: 'Invoke',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace ?? CONFIGS.defaultNamespace,
      ClientContext: JSON.stringify(inputs.clientContext ?? {}),
      LogType: inputs.logType ?? 'Tail',
      InvocationType: inputs.invocationType || 'RequestResponse',
    });
    return Response;
  }
}
