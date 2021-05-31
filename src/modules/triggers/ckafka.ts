import { CapiCredentials, RegionType } from './../interface';
import { TriggerInputs, CkafkaTriggerInputsParams, CreateTriggerReq } from './interface';
import Scf from '../scf';
import { TRIGGER_STATUS_MAP } from './base';
import { TriggerManager } from './manager';

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

  formatInputs({ inputs }: { inputs: TriggerInputs<CkafkaTriggerInputsParams> }) {
    const { parameters } = inputs;
    const triggerInputs: CreateTriggerReq = {
      Action: 'CreateTrigger',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,
      Type: 'ckafka',
      Qualifier: parameters?.qualifier ?? '$DEFAULT',
      TriggerName: `${parameters?.name}-${parameters?.topic}`,
      TriggerDesc: JSON.stringify({
        maxMsgNum: parameters?.maxMsgNum ?? 100,
        offset: parameters?.offset ?? 'latest',
        retry: parameters?.retry ?? 10000,
        timeOut: parameters?.timeout ?? 60,
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
  }: {
    scf: Scf | TriggerManager;
    region: RegionType;
    inputs: TriggerInputs<CkafkaTriggerInputsParams>;
  }) {
    const { triggerInputs } = this.formatInputs({ inputs });
    console.log(`Creating ${triggerInputs.Type} trigger ${triggerInputs.TriggerName}`);
    const { TriggerInfo } = await scf.request(triggerInputs as any);
    TriggerInfo.Qualifier = TriggerInfo.Qualifier || triggerInputs.Qualifier;
    return TriggerInfo;
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
