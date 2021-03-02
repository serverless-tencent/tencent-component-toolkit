import Scf from '../scf';
import { CapiCredentials, RegionType } from './../interface';
import BaseTrigger, { TRIGGER_STATUS_MAP } from './base';
import { CosTriggerParams, TriggerInputs, TriggerData, CosTriggerDesc } from './interface';
export default class CosTrigger extends BaseTrigger<CosTriggerParams, CosTriggerDesc> {
  credentials: CapiCredentials;
  region: RegionType;

  constructor({ credentials, region }: { credentials: CapiCredentials; region: RegionType }) {
    super();
    this.credentials = credentials;
    this.region = region;
  }

  getKey(triggerInputs: TriggerData<CosTriggerDesc>) {
    const tempDest = JSON.stringify({
      bucketUrl: triggerInputs.TriggerName,
      event: JSON.parse(triggerInputs.TriggerDesc!).event,
      filter: JSON.parse(triggerInputs.TriggerDesc!).filter,
    });
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable!];
    return `cos-${triggerInputs.TriggerName}-${tempDest}-${Enable}-${triggerInputs.Qualifier}`;
  }

  formatInputs({ inputs }: { inputs: TriggerInputs<CosTriggerParams> }) {
    const { parameters } = inputs;
    const triggerInputs: TriggerData<CosTriggerDesc> = {
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,

      Type: 'cos',
      Qualifier: parameters?.qualifier || '$DEFAULT',
      TriggerName: parameters?.bucket,
      TriggerDesc: JSON.stringify({
        event: parameters?.events,
        filter: {
          Prefix: parameters?.filter?.prefix ?? '',
          Suffix: parameters?.filter?.suffix ?? '',
        },
      }),
      Enable: parameters?.enable ? 'OPEN' : 'CLOSE',
    };

    const triggerKey = this.getKey(triggerInputs);

    return {
      triggerInputs,
      triggerKey,
    } as any;
  }

  async create({ scf, inputs }: { scf: Scf; inputs: TriggerInputs<CosTriggerParams> }) {
    const { triggerInputs } = this.formatInputs({ inputs });
    console.log(`Creating ${triggerInputs.Type} trigger ${triggerInputs.TriggerName}`);
    const { TriggerInfo } = await scf.request({
      Action: 'CreateTrigger',
      ...triggerInputs,
    });
    TriggerInfo.Qualifier = TriggerInfo.Qualifier || triggerInputs.Qualifier;

    return TriggerInfo;
  }

  async delete({ scf, inputs }: { scf: Scf; inputs: TriggerInputs<CosTriggerParams> }) {
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
