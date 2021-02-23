import Scf from '../scf';
import { CapiCredentials, RegionType } from './../interface';
import BaseTrigger from './base';
import { CmqTriggerParams, TriggerInputs, TriggerData, CmqTriggerDesc } from './interface';
const { TRIGGER_STATUS_MAP } = require('./base');

export default class CmqTrigger extends BaseTrigger<CmqTriggerParams, CmqTriggerDesc> {
  credentials: CapiCredentials;
  region: RegionType;

  constructor({ credentials, region }: { credentials: CapiCredentials; region: RegionType }) {
    super();
    this.credentials = credentials;
    this.region = region;
  }

  getKey(triggerInputs: TriggerData<CmqTriggerDesc>) {
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable!];
    return `${triggerInputs.Type}-${triggerInputs.TriggerName}-${triggerInputs.TriggerDesc}-${Enable}-${triggerInputs.Qualifier}`;
  }

  formatInputs({ inputs }: { inputs: TriggerInputs<CmqTriggerParams> }) {
    const { parameters } = inputs;
    const triggerInputs: TriggerData<CmqTriggerDesc> = {
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,

      Type: 'cmq',
      Qualifier: parameters?.qualifier || '$DEFAULT',
      TriggerName: parameters?.name,
      TriggerDesc: JSON.stringify({
        filterType: 1,
        filterKey: parameters?.filterKey,
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
    scf: Scf;
    region: RegionType;
    inputs: TriggerInputs<CmqTriggerParams>;
  }) {
    const { triggerInputs } = this.formatInputs({ inputs });
    console.log(`Creating ${triggerInputs.Type} trigger ${triggerInputs.TriggerName}`);
    const { TriggerInfo } = await scf.request({
      ...triggerInputs,
      Action: 'CreateTrigger' as const,
    });
    TriggerInfo.Qualifier = TriggerInfo.Qualifier || triggerInputs.Qualifier;
    return TriggerInfo;
  }

  async delete({ scf, inputs }: { scf: Scf; inputs: TriggerInputs<CmqTriggerParams> }) {
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
