import { CapiCredentials, RegionType } from './../interface';
import { TriggerInputs, ChafkaTriggerInputsParams, CreateTriggerReq } from './interface';
import Scf from '../scf';
import { TRIGGER_STATUS_MAP } from './base';

export default class CkafkaTrigger {
  credentials: CapiCredentials;
  region: RegionType;

  constructor({ credentials, region }: { credentials: CapiCredentials; region: RegionType }) {
    this.credentials = credentials;
    this.region = region;
  }

  getKey(triggerInputs: CreateTriggerReq) {
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable!];
    return `${triggerInputs.Type}-${triggerInputs.TriggerName}-${triggerInputs.TriggerDesc}-${Enable}-${triggerInputs.Qualifier}`;
  }

  formatInputs({
    // FIXME: region unused
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    region,
    inputs,
  }: {
    region: RegionType;
    inputs: TriggerInputs<ChafkaTriggerInputsParams>;
  }) {
    const { parameters } = inputs;
    const triggerInputs: CreateTriggerReq = {
      Action: 'CreateTrigger',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,
      Type: 'chafka',
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
  async create({
    scf,
    region,
    inputs,
  }: {
    scf: Scf;
    region: RegionType;
    inputs: TriggerInputs<ChafkaTriggerInputsParams>;
  }) {
    const { triggerInputs } = this.formatInputs({ region, inputs });
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
