import { CapiCredentials, RegionType } from './../interface';
import { TriggerInputs, CkafkaTriggerInputsParams, CreateTriggerReq,TriggerAction } from './interface';
import Scf from '../scf';
import { TRIGGER_STATUS_MAP  } from './base';
import { TriggerManager } from './manager';
import { getScfTriggerByName } from './utils';

export default class CkafkaTrigger {
  credentials: CapiCredentials;
  region: RegionType;

  constructor({ credentials, region }: { credentials: CapiCredentials; region: RegionType }) {
    this.credentials = credentials;
    this.region = region;
  }

  getKey(triggerInputs: CreateTriggerReq) {
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable!];

    let desc = triggerInputs.TriggerDesc;
    if (triggerInputs.ResourceId) {
      const detailDesc = JSON.parse(triggerInputs.TriggerDesc);
      desc = JSON.stringify({
        maxMsgNum: detailDesc.maxMsgNum,
        offset: detailDesc.offset,
        retry: detailDesc.retry,
        timeOut: detailDesc.timeOut,
      });
    }
    return `${triggerInputs.Type}-${triggerInputs.TriggerName}-${desc}-${Enable}-${triggerInputs.Qualifier}`;
  }

  formatInputs({ inputs,action = 'CreateTrigger'}: { inputs: TriggerInputs<CkafkaTriggerInputsParams>,action?: TriggerAction }) {
    const { parameters } = inputs;
    const triggerName = parameters?.name ||  `${parameters?.instanceId}-${parameters?.topic}`;
    const triggerInputs: CreateTriggerReq = {
      Action: action,
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,
      Type: 'ckafka',
      Qualifier: parameters?.qualifier ?? '$DEFAULT',
      TriggerName: triggerName,
      TriggerDesc: JSON.stringify({
        maxMsgNum: parameters?.maxMsgNum ?? 100,
        offset: parameters?.offset ?? 'latest',
        retry: parameters?.retry ?? 10000,
        timeOut: parameters?.timeout ?? 60,
        consumerGroupName: parameters?.consumerGroupName ?? '',
      }),
      Enable: parameters?.enable ? 'OPEN' : 'CLOSE',
    };

    const triggerKey = this.getKey(triggerInputs);

    return {
      triggerInputs,
      triggerKey,
    };
  }
  async create({
    scf,
    inputs,
    region
  }: {
    scf: Scf | TriggerManager;
    region: RegionType;
    inputs: TriggerInputs<CkafkaTriggerInputsParams>;
  }) {
    // 查询当前触发器是否已存在
    const existTrigger = await getScfTriggerByName({ scf, region, inputs });
    // 更新触发器
    if (existTrigger) {
      const { triggerInputs } = this.formatInputs({ inputs, action: 'UpdateTrigger' });
      console.log(`${triggerInputs.Type} trigger ${triggerInputs.TriggerName} is exist`)
      console.log(`Updating ${triggerInputs.Type} trigger ${triggerInputs.TriggerName}`);
      try {
          // 更新触发器
          await scf.request(triggerInputs as any);
          // 更新成功后，查询最新的触发器信息
          const trigger = await getScfTriggerByName({ scf, region, inputs });
          return trigger;
      } catch (error) {
        return {}
      }
    } else { // 创建触发器
      const { triggerInputs } = this.formatInputs({ inputs });
      console.log(`Creating ${triggerInputs.Type} trigger ${triggerInputs.TriggerName}`);
      const { TriggerInfo } = await scf.request(triggerInputs as any);
      TriggerInfo.Qualifier = TriggerInfo.Qualifier || triggerInputs.Qualifier;
      return TriggerInfo;
    }
  }
  async delete({ scf, inputs }: { scf: Scf; inputs: TriggerInputs }) {
    console.log(`Removing ${inputs.type} trigger ${inputs.triggerName}`);
    try {
      await scf.request({
        Action: 'DeleteTrigger',
        FunctionName: inputs.functionName,
        Namespace: inputs.namespace,
        Type: inputs.type,
        TriggerDesc: inputs.triggerDesc,
        TriggerName: inputs.triggerName,
        Qualifier: inputs.qualifier,
      });
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}
