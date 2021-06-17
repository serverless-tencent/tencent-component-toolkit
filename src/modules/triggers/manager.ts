import { SimpleApigwDetail } from './interface/index';
import { Capi } from '@tencent-sdk/capi';
import { sleep } from '@ygkit/request';
import { ActionType } from '../scf/apis';
import { RegionType, ApiServiceType, CapiCredentials } from '../interface';
import { ApiError } from '../../utils/error';
import { deepClone } from '../../utils';
import TagsUtils from '../tag/index';
import ApigwUtils from '../apigw';
import APIS from '../scf/apis';
import TRIGGERS from '.';
import BaseTrigger, { CAN_UPDATE_TRIGGER } from './base';
import { TriggerDetail, NewTriggerInputs } from './interface';
import ScfEntity from '../scf/entities/scf';

export interface ApiInputs {
  path: string;
  method: string;
  function: {
    name: string;
    namespace?: string;
    qualifier?: string;
    // 兼容旧的配置
    functionName?: string;
    functionQualifier?: string;
    functionNamespace?: string;
  };

  [key: string]: any;
}

/** 云函数组件 */
export class TriggerManager {
  tagClient: TagsUtils;
  apigwClient: ApigwUtils;
  capi: Capi;
  region: RegionType;
  credentials: CapiCredentials;

  triggersCache: Record<string, any> = {};
  scfNameCache: Record<string, any> = {};

  scf: ScfEntity;

  // 当前正在执行的触发器任务数
  runningTasks = 0;
  // 支持并行执行的最大触发器任务数
  maxRunningTasks = 1;

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
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, data);
    return result;
  }

  // 获取函数下所有触发器
  async getScfTriggers({
    name,
    namespace = 'default',
  }: {
    name: string;
    namespace?: string;
  }): Promise<TriggerDetail[]> {
    const { Triggers = [], TotalCount } = await this.request({
      Action: 'ListTriggers',
      FunctionName: name,
      Namespace: namespace,
      Limit: 100,
    });
    if (TotalCount > 100) {
      const res = await this.getScfTriggers({ name, namespace });
      return Triggers.concat(res);
    }

    return Triggers;
  }

  async filterTriggers({
    name,
    namespace,
    events,
    oldList,
  }: {
    name: string;
    namespace: string;
    events: NewTriggerInputs[];
    oldList: TriggerDetail[];
  }) {
    const deleteList: (TriggerDetail | null)[] = deepClone(oldList);
    const createList: (NewTriggerInputs | null)[] = deepClone(events);
    const deployList: (TriggerDetail | null)[] = [];
    const updateList: (NewTriggerInputs | null)[] = [];

    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      const { type } = event;
      const TriggerClass = TRIGGERS[type];
      const triggerInstance: BaseTrigger = new TriggerClass({
        credentials: this.credentials,
        region: this.region,
      });
      const { triggerKey } = await triggerInstance.formatInputs({
        region: this.region,
        inputs: {
          namespace: namespace,
          functionName: name,
          ...event,
        },
      });
      deployList[index] = {
        NeedCreate: true,
        Type: type,
        triggerType: type,
        ...event,
      };

      for (let i = 0; i < oldList.length; i++) {
        const oldTrigger = oldList[i];
        // 如果类型不一致或者已经比较过（key值一致），则继续下一次循环
        if (oldTrigger.Type !== type || oldTrigger.compared === true) {
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
        if (CAN_UPDATE_TRIGGER.indexOf(type) === -1) {
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
      deleteList: deleteList.filter((item) => item) as TriggerDetail[],
      createList: createList.filter((item) => item) as NewTriggerInputs[],
      deployList: deployList.map((item) => {
        delete item?.compared;
        return item as TriggerDetail;
      }),
    };
  }

  async removeTrigger({
    trigger,
    name,
    namespace = 'default',
  }: {
    name: string;
    namespace: string;
    trigger: TriggerDetail;
  }) {
    const { triggerType } = trigger;
    const TriggerClass = TRIGGERS[triggerType];

    if (TriggerClass) {
      const triggerInstance = new TriggerClass({
        credentials: this.credentials,
        region: this.region,
      });

      await triggerInstance.delete({
        scf: this,
        region: this.region,
        inputs: {
          functionName: name,
          namespace,
          type: trigger?.Type,
          triggerDesc: trigger?.TriggerDesc,
          triggerName: trigger?.TriggerName,
          qualifier: trigger?.Qualifier,
        },
      });
    }
  }

  // 部署函数触发器
  async deployTrigger({
    name,
    namespace = 'default',
    events = [],
  }: {
    name: string;
    namespace?: string;
    events?: any[];
  }) {
    console.log(`Deploying triggers for function ${name}`);

    const triggerList = await this.getScfTriggers({ name, namespace });

    // 由于大部分触发器类型（除了 API网关触发器）是无法更新的
    // 因此如果用户更新了触发器配置，就需要先删除再创建
    const { deleteList, deployList } = await this.filterTriggers({
      name,
      namespace,
      events,
      oldList: triggerList,
    });

    // 1. 删除老的无法更新的触发器
    for (let i = 0, len = deleteList.length; i < len; i++) {
      const trigger = deleteList[i];
      await this.removeTrigger({
        name,
        namespace,
        trigger,
      });
    }

    // 2. 创建新的触发器
    const apigwServiceList = [];
    for (let i = 0; i < deployList.length; i++) {
      const trigger = deployList[i];
      const { Type } = trigger;
      if (trigger?.NeedCreate === true) {
        const TriggerClass = TRIGGERS[Type];
        if (!TriggerClass) {
          throw new ApiError({
            type: 'PARAMETER_ERROR',
            message: `[TRIGGER] 未知触发器类型： ${Type}`,
          });
        }
        const triggerInstance = new TriggerClass({
          credentials: this.credentials,
          region: this.region,
        });
        // 针对触发器创建接口限频，由于后端服务问题，必须设置并发为 1
        // TODO: 兼容多个网关触发器并行部署时，服务发布会报错，待后端接口支持状态查询后再额外改造 apigw 模块
        this.runningTasks++;
        if (this.runningTasks > this.maxRunningTasks) {
          await sleep(1000);
        }

        // 禁用自动发布
        trigger.isAutoRelease = true;
        const triggerOutput = await triggerInstance.create({
          scf: this,
          region: this.region,
          inputs: {
            namespace,
            functionName: name,
            ...trigger,
          },
        });
        // 筛选出 API 网关触发器，可以单独的进行发布
        if (triggerOutput.serviceId) {
          apigwServiceList.push({
            serviceId: triggerOutput.serviceId,
            environment: triggerOutput.environment,
          });
        }
        this.runningTasks--;

        deployList[i] = {
          ...triggerOutput,
          triggerType: Type,
        };
      } else {
        deployList[i] = {
          ...deployList[i],
          triggerType: Type,
        };
        delete deployList[i].NeedCreate;
      }
    }
    const outputs: { name: string; triggers: TriggerDetail[] } = {
      name,
      triggers: deployList,
    };
    return { outputs, apigwServiceList };
  }

  /**
   * 初始化 API 网关触发器配置
   * 说明：如果配置了 serviceId，检查是否确实存在，如果不存在则自动创建
   *      如果没有配置，则直接创建
   * @param triggerInputs API 网关触发器配置
   * @returns {string} serviceId API 网关 ID
   */
  async initializeApigwService(triggerInputs: NewTriggerInputs) {
    const { parameters } = triggerInputs;
    let isServiceExist = false;
    const { serviceId } = parameters;
    const outputs = {
      serviceId,
      created: false,
    };
    if (serviceId) {
      const detail = await this.apigwClient.service.getById(serviceId);
      if (detail) {
        isServiceExist = true;
      }
    }
    if (!isServiceExist) {
      const res = await this.apigwClient.deploy({
        oldState: triggerInputs.parameters.oldState,
        region: this.region,
        protocols: parameters.protocols,
        environment: parameters.environment,
        serviceId: parameters.serviceId,
        serviceName: parameters.serviceName,
        serviceDesc: parameters.serviceDesc,

        // 定制化需求：是否在 yaml 文件中配置了 apigw 触发器的 serviceId
        isInputServiceId: parameters.isInputServiceId,

        // 定制化需求：是否是删除云函数的api网关触发器，跟api网关组件区分开
        isRemoveTrigger: true,
        netTypes: parameters?.netTypes,
      });
      outputs.created = true;
      outputs.serviceId = res.serviceId;
    }
    return outputs;
  }

  /**
   * 通过触发器中配置的 function 字段，获取涉及到的所有函数
   * @param triggers 触发器配置列表
   * @returns 函数列表
   */
  async getScfsByTriggers(triggers: NewTriggerInputs[] = []) {
    for (let i = 0; i < triggers.length; i++) {
      const curTrigger = triggers[i];
      if (curTrigger.type === 'apigw') {
        const { parameters } = curTrigger;
        // 创建 网关
        const { serviceId, created } = await this.initializeApigwService(curTrigger);
        curTrigger.parameters.serviceId = serviceId;
        const oldState = curTrigger.parameters.oldState ?? {};
        oldState.created = created;
        curTrigger.parameters.oldState = oldState;

        const { endpoints = [] } = parameters;
        for (let j = 0; j < endpoints?.length; j++) {
          const curApi = endpoints[j];
          const { name } = curApi.function!;
          if (name && !this.scfNameCache[name]) {
            this.scfNameCache[name] = curApi.function;
          }
        }
      } else {
        const { name } = curTrigger.function!;
        if (!this.scfNameCache[name]) {
          this.scfNameCache[name] = curTrigger.function;
        }
      }
    }
    return Object.values(this.scfNameCache);
  }

  /**
   * 通过函数名称和触发器列表，获取当前函数名称的触发器配置
   * @param options 获取函数触发器配置参数
   * @returns 触发器配置
   */
  getScfTriggersConfig({ name, triggers = [] }: { name: string; triggers: NewTriggerInputs[] }) {
    const cloneTriggers = deepClone(triggers);
    return cloneTriggers.filter((item) => {
      if (item.type === 'apigw') {
        const {
          parameters: { endpoints = [] },
        } = item;

        const apiList = endpoints.filter((api) => {
          return api.function!.name === name;
        });
        item.parameters.endpoints = apiList;

        return apiList.length > 0;
      }
      return item.function!.name === name;
    });
  }

  async bulkReleaseApigw(list: SimpleApigwDetail[]) {
    // 筛选非重复的网关服务
    const uniqueList: SimpleApigwDetail[] = [];
    const map: { [key: string]: number } = {};
    list.forEach((item) => {
      if (!map[item.serviceId]) {
        map[item.serviceId] = 1;
        uniqueList.push(item);
      }
    });

    const releaseTask: Promise<any>[] = [];
    for (let i = 0; i < uniqueList.length; i++) {
      const temp = uniqueList[i];
      releaseTask.push(this.apigwClient.service.release(temp));
    }
    await Promise.all(releaseTask);
  }

  /**
   * 批量处理多函数关联的触发器配置
   * @param triggers 触发器列表
   * @returns 触发器部署 outputs
   */
  async bulkCreateTriggers(triggers: NewTriggerInputs[] = []) {
    const scfList = await this.getScfsByTriggers(triggers);

    let apigwList: SimpleApigwDetail[] = [];
    const createTasks: Promise<any>[] = [];
    for (let i = 0; i < scfList.length; i++) {
      const curScf = scfList[i];
      const triggersConfig = this.getScfTriggersConfig({
        name: curScf.name,
        triggers,
      });
      const task = async () => {
        const { outputs, apigwServiceList } = await this.deployTrigger({
          name: curScf.name,
          namespace: curScf.namespace,
          events: triggersConfig,
        });
        apigwList = apigwList.concat(apigwServiceList);
        return outputs;
      };

      createTasks.push(task());
    }
    const res = await Promise.all(createTasks);

    await this.bulkReleaseApigw(apigwList);

    return res;
  }

  /**
   * 批量删除指定函数的触发器
   * @param options 参数
   */
  async bulkRemoveTriggers({
    name,
    namespace = 'default',
    triggers = [],
  }: {
    name: string;
    namespace: string;
    triggers: TriggerDetail[];
  }) {
    const removeTasks: Promise<void>[] = [];

    triggers.forEach((item) => {
      const pms = async () => {
        await this.request({
          Action: 'DeleteTrigger',
          FunctionName: name,
          Namespace: namespace,
          Type: item.Type,
          TriggerDesc: item.TriggerDesc,
          TriggerName: item.TriggerName,
          Qualifier: item.Qualifier,
        });
      };
      removeTasks.push(pms());
    });

    await Promise.all(removeTasks);

    return true;
  }

  /**
   * 清理指定函数所有触发器
   * @param options 参数
   */
  async clearScfTriggers({ name, namespace }: { name: string; namespace: string }) {
    const list = await this.getScfTriggers({ name, namespace });

    await this.bulkRemoveTriggers({
      name,
      namespace,
      triggers: list,
    });

    return true;
  }
}
