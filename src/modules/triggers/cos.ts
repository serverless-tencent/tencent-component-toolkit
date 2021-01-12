import Scf from '../scf';
import { CapiCredentials, RegionType } from './../interface';
import BaseTrigger from './base';
import { CosTriggerInputsParams, TriggerInputs } from './interface';
const { TRIGGER_STATUS_MAP } = require('./base');

export default class CosTrigger extends BaseTrigger<CosTriggerInputsParams> {
  credentials: CapiCredentials;
  region: RegionType;

  constructor({ credentials, region }: { credentials: CapiCredentials; region: RegionType }) {
    super();
    this.credentials = credentials;
    this.region = region;
  }

  getKey(triggerInputs: {
    TriggerName: string;
    TriggerDesc: string;
    Enable: string;
    Qualifier: string;
  }) {
    const tempDest = JSON.stringify({
      bucketUrl: triggerInputs.TriggerName,
      event: JSON.parse(triggerInputs.TriggerDesc).event,
      filter: JSON.parse(triggerInputs.TriggerDesc).filter,
    });
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable];
    return `cos-${triggerInputs.TriggerName}-${tempDest}-${Enable}-${triggerInputs.Qualifier}`;
  }

  formatInputs({ inputs }: { region: RegionType; inputs: TriggerInputs<CosTriggerInputsParams> }) {
    const { parameters } = inputs;
    const triggerInputs = {
      Action: 'CreateTrigger',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,

      Type: 'cos',
      Qualifier: parameters.qualifier || '$DEFAULT',
      TriggerName: parameters.bucket,
      TriggerDesc: JSON.stringify({
        event: parameters.events,
        filter: {
          Prefix: parameters.filter?.prefix ?? '',
          Suffix: parameters.filter?.suffix ?? '',
        },
      }),
      Enable: parameters.enable ? 'OPEN' : 'CLOSE',
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
    scf: Scf;
    region: RegionType;
    inputs: TriggerInputs<CosTriggerInputsParams>;
  }) {
    const { triggerInputs } = this.formatInputs({ region, inputs });
    console.log(`Creating ${triggerInputs.Type} trigger ${triggerInputs.TriggerName}`);
    const { TriggerInfo } = await scf.request(triggerInputs);
    return TriggerInfo;
  }

  async delete({ scf, inputs }: { scf: Scf; inputs: TriggerInputs<CosTriggerInputsParams> }) {
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
