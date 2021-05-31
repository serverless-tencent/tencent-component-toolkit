import Scf from '../scf';
import { TriggerManager } from './manager';
import { CapiCredentials, RegionType } from './../interface';
import BaseTrigger from './base';
import { CmqTriggerInputsParams, TriggerInputs, CreateTriggerReq } from './interface';
const { TRIGGER_STATUS_MAP } = require('./base');

export default class CmqTrigger extends BaseTrigger<CmqTriggerInputsParams> {
  credentials: CapiCredentials;
  region: RegionType;

  constructor({ credentials, region }: { credentials: CapiCredentials; region: RegionType }) {
    super();
    this.credentials = credentials;
    this.region = region;
  }

  getKey(triggerInputs: CreateTriggerReq) {
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable!];
    return `${triggerInputs.Type}-${triggerInputs.TriggerName}-${triggerInputs.TriggerDesc}-${Enable}-${triggerInputs.Qualifier}`;
  }

  formatInputs({ inputs }: { region: RegionType; inputs: TriggerInputs<CmqTriggerInputsParams> }) {
    const { parameters } = inputs;
    const triggerInputs: CreateTriggerReq = {
      Action: 'CreateTrigger',
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
    } as any;
  }
  async create({
    scf,
    region,
    inputs,
  }: {
    scf: Scf | TriggerManager;
    region: RegionType;
    inputs: TriggerInputs<CmqTriggerInputsParams>;
  }) {
    const { triggerInputs } = this.formatInputs({ region, inputs });
    console.log(`Creating ${triggerInputs.Type} trigger ${triggerInputs.TriggerName}`);
    const { TriggerInfo } = await scf.request(triggerInputs);
    TriggerInfo.Qualifier = TriggerInfo.Qualifier || triggerInputs.Qualifier;
    return TriggerInfo;
  }

  async delete({
    scf,
    inputs,
  }: {
    scf: Scf | TriggerManager;
    inputs: TriggerInputs<CmqTriggerInputsParams>;
  }) {
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
