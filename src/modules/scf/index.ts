import { ActionType } from './apis';
import { RegionType, ApiServiceType, CapiCredentials } from './../interface';
import { Capi } from '@tencent-sdk/capi';
import { ApiTypeError } from '../../utils/error';
import { deepClone, strip } from '../../utils';
import TagsUtils from '../tag/index';
import ApigwUtils from '../apigw';
import CONFIGS from './config';
import APIS from './apis';
import TRIGGERS from '../triggers';
import BaseTrigger, { CAN_UPDATE_TRIGGER } from '../triggers/base';
import {
  FunctionInfo,
  TriggerType,
  ScfDeployInputs,
  ScfRemoveInputs,
  ScfInvokeInputs,
  ScfDeployTriggersInputs,
  ScfDeployOutputs,
  OriginTriggerType,
  GetLogOptions,
} from './interface';
import ScfEntity from './entities/scf';
import AliasEntity from './entities/alias';
import VersionEntity from './entities/version';

/** 云函数组件 */
export default class Scf {
  tagClient: TagsUtils;
  apigwClient: ApigwUtils;
  capi: Capi;
  region: RegionType;
  credentials: CapiCredentials;

  scf: ScfEntity;
  alias: AliasEntity;
  version: VersionEntity;

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

    this.scf = new ScfEntity(this.capi, region);
    this.alias = new AliasEntity(this.capi);
    this.version = new VersionEntity(this.capi);
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, data);
    return result;
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

  async filterTriggers(
    funcInfo: FunctionInfo,
    events: OriginTriggerType[],
    oldList: TriggerType[],
  ) {
    const deleteList: (TriggerType | null)[] = deepClone(oldList);
    const createList: (OriginTriggerType | null)[] = deepClone(events);
    const deployList: (TriggerType | null)[] = [];
    // const noKeyTypes = ['apigw'];
    const updateList: (OriginTriggerType | null)[] = [];

    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      const Type = Object.keys(event)[0];
      const TriggerClass = TRIGGERS[Type];
      const triggerInstance: BaseTrigger = new TriggerClass({
        credentials: this.credentials,
        region: this.region,
      });
      const { triggerKey } = await triggerInstance.formatInputs({
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

      for (let i = 0; i < oldList.length; i++) {
        const oldTrigger = oldList[i];
        // 如果类型不一致或者已经比较过（key值一致），则继续下一次循环
        if (oldTrigger.Type !== Type || oldTrigger.compared === true) {
          continue;
        }
        const OldTriggerClass = TRIGGERS[oldTrigger.Type];
        const oldTriggerInstance = new OldTriggerClass({
          credentials: this.credentials,
          region: this.region,
        });
        const oldKey = await oldTriggerInstance.getKey(oldTrigger);

        // 如果 key 不一致则继续下一次循环
        if (oldKey !== triggerKey) {
          continue;
        }

        oldList[i].compared = true;

        deleteList[i] = null;
        updateList.push(createList[index]);
        if (CAN_UPDATE_TRIGGER.indexOf(Type) === -1) {
          createList[index] = null;
          deployList[index] = {
            NeedCreate: false,
            ...oldTrigger,
          };
        }
        // 如果找到 key 值一样的，直接跳出循环
        break;
      }
    }
    return {
      updateList,
      deleteList: deleteList.filter((item) => item) as TriggerType[],
      createList: createList.filter((item) => item) as OriginTriggerType[],
      deployList: deployList.map((item) => {
        delete item?.compared;
        return item as TriggerType;
      }),
    };
  }

  // 部署函数触发器
  async deployTrigger(funcInfo: FunctionInfo, inputs: ScfDeployTriggersInputs) {
    console.log(`Deploying triggers for function ${funcInfo.FunctionName}`);

    // should check function status is active, then continue
    await this.scf.isOperational({ namespace: inputs.namespace, functionName: inputs.name! });

    // get all triggers
    const triggerList = await this.getTriggerList(funcInfo.FunctionName, funcInfo.Namespace);

    const { deleteList, deployList } = await this.filterTriggers(
      funcInfo,
      inputs.events!,
      triggerList,
    );

    // remove all old triggers
    for (let i = 0, len = deleteList.length; i < len; i++) {
      const trigger = deleteList[i];
      const { Type } = trigger;
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
      const { Type } = trigger;
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

  // deploy SCF flow
  async deploy(inputs: ScfDeployInputs): Promise<ScfDeployOutputs> {
    const namespace = inputs.namespace ?? CONFIGS.defaultNamespace;
    const functionName = inputs.name;

    // 在部署前，检查函数初始状态，如果初始为 CreateFailed，尝试先删除，再重新创建
    let funcInfo = await this.scf.getInitialStatus({ namespace, functionName });

    // 检查函数是否存在，不存在就创建，存在就更新
    if (!funcInfo) {
      await this.scf.create(inputs);
    } else {
      await this.scf.updateCode(inputs, funcInfo);

      await this.scf.isOperational({ namespace, functionName });

      await this.scf.updateConfigure(inputs, funcInfo);
    }

    funcInfo = await this.scf.isOperational({ namespace, functionName });

    const outputs = (funcInfo as ScfDeployOutputs) || ({} as ScfDeployOutputs);
    if (inputs.publish) {
      const { FunctionVersion } = await this.version.publish({
        functionName,
        region: this.region,
        namespace,
        description: inputs.publishDescription,
      });
      inputs.lastVersion = FunctionVersion;
      outputs.LastVersion = FunctionVersion;

      await this.scf.isOperational({
        namespace,
        functionName,
        qualifier: inputs.lastVersion,
      });
    }

    const needSetTraffic =
      inputs.traffic != null && inputs.lastVersion && inputs.lastVersion !== '$LATEST';
    if (needSetTraffic) {
      await this.alias.update({
        namespace,
        functionName,
        region: this.region,
        traffic: strip(1 - inputs.traffic!),
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
      const defaultAlias = await this.alias.get({
        functionName,
        region: this.region,
        namespace,
      });
      if (
        defaultAlias &&
        defaultAlias.RoutingConfig &&
        defaultAlias.RoutingConfig.AdditionalVersionWeights &&
        defaultAlias.RoutingConfig.AdditionalVersionWeights.length > 0
      ) {
        const weights = defaultAlias.RoutingConfig.AdditionalVersionWeights;
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
        resourceId: `${funcInfo!.Namespace}/function/${funcInfo!.FunctionName}`,
        serviceType: ApiServiceType.scf,
        resourcePrefix: 'namespace',
      });

      outputs.Tags = deployedTags.map((item) => ({ Key: item.TagKey, Value: item.TagValue! }));
    }

    // create/update/delete triggers
    if (inputs.events) {
      outputs.Triggers = await this.deployTrigger(funcInfo!, inputs);
    }

    console.log(`Deploy function ${functionName} success.`);
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
    const func = await this.scf.get({ namespace, functionName });

    if (!func) {
      console.log(`Function ${functionName} not exist`);
      return true;
    }

    if (func.Status === 'Updating' || func.Status === 'Creating') {
      console.log(`Function ${functionName} status is ${func.Status}, can not delete`);
      return false;
    }

    try {
      await this.scf.isOperational({ namespace, functionName });
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

    await this.scf.delete({ namespace, functionName });

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

  async logs(inputs: GetLogOptions = {} as GetLogOptions) {
    const logs = await this.scf.getLogs(inputs);
    return logs;
  }
}
