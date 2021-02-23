import { CapiCredentials, RegionType } from './../interface';
import { TriggerInputs, CkafkaTriggerParams, TriggerData, CkafkaTriggerDesc } from './interface';
import Scf from '../scf';
import BaseTrigger, { TRIGGER_STATUS_MAP } from './base';

export default class CkafkaTrigger extends BaseTrigger<CkafkaTriggerParams, CkafkaTriggerDesc> {
  credentials: CapiCredentials;
  region: RegionType;

  constructor({ credentials, region }: { credentials: CapiCredentials; region: RegionType }) {
    super();
    this.credentials = credentials;
    this.region = region;
  }

  getKey(triggerInputs: TriggerData<CkafkaTriggerDesc>) {
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable!];
    return `${triggerInputs.Type}-${triggerInputs.TriggerName}-${triggerInputs.TriggerDesc}-${Enable}-${triggerInputs.Qualifier}`;
  }

  formatInputs({ inputs }: { inputs: TriggerInputs<CkafkaTriggerParams> }) {
    const { parameters } = inputs;
    const triggerInputs: TriggerData<CkafkaTriggerDesc> = {
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,
      Type: 'ckafka',
      Qualifier: parameters?.qualifier ?? '$DEFAULT',
      TriggerName: `${parameters?.name}-${parameters?.topic}`,
      TriggerDesc: JSON.stringify({
        maxMsgNum: parameters?.maxMsgNum,
        offset: parameters?.offset,
        retry: parameters?.retry,
      }),
      Enable: parameters?.enable ? 'OPEN' : 'CLOSE',
    };

    const triggerKey = this.getKey(triggerInputs);

    return {
      triggerInputs,
      triggerKey,
    };
  }
  async create({ scf, inputs }: { scf: Scf; inputs: TriggerInputs<CkafkaTriggerParams> }) {
    const { triggerInputs } = this.formatInputs({ inputs });
    console.log(`Creating ${triggerInputs.Type} trigger ${triggerInputs.TriggerName}`);
    const { TriggerInfo } = await scf.request({
      ...triggerInputs,
      Action: 'CreateTrigger',
    });
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
