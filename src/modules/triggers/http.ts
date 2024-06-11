import Scf from '../scf';
import { TriggerManager } from './manager';
import { CapiCredentials, RegionType } from './../interface';
import BaseTrigger from './base';
import { HttpTriggerInputsParams, TriggerInputs, CreateTriggerReq } from './interface';

export default class HttpTrigger extends BaseTrigger<HttpTriggerInputsParams> {
  credentials: CapiCredentials;
  region: RegionType;

  constructor({ credentials, region }: { credentials: CapiCredentials; region: RegionType }) {
    super();
    this.credentials = credentials;
    this.region = region;
  }

  getKey(triggerInputs: CreateTriggerReq) {
    const triggerDesc = JSON.parse(triggerInputs.TriggerDesc!);
    const tempDest = JSON.stringify({
      authType: triggerDesc?.AuthType,
      enableIntranet: triggerDesc?.NetConfig?.EnableIntranet,
      enableExtranet: triggerDesc?.NetConfig?.EnableExtranet,
    });
    return `http-${tempDest}-${triggerInputs.Qualifier}`;
  }

  formatInputs({ inputs }: { region: RegionType; inputs: TriggerInputs<HttpTriggerInputsParams> }) {
    const { parameters } = inputs;
    const triggerInputs: CreateTriggerReq = {
      Action: 'CreateTrigger',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,

      Type: 'http',
      Qualifier: parameters?.qualifier || '$DEFAULT',
      TriggerName: parameters?.name || 'url-trigger',
      TriggerDesc: JSON.stringify({
        AuthType: parameters?.authType || 'NONE',
        NetConfig: {
          EnableIntranet: parameters?.netConfig?.enableIntranet ?? false,
          EnableExtranet: parameters?.netConfig?.enableExtranet ?? false,
        },
      }),
      Enable: 'OPEN',
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
    inputs: TriggerInputs<HttpTriggerInputsParams>;
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
    inputs: TriggerInputs<HttpTriggerInputsParams>;
  }) {
    console.log(`Removing ${inputs.type} trigger ${inputs.triggerName}`);
    try {
      await scf.request({
        Action: 'DeleteTrigger',
        FunctionName: inputs.functionName,
        Namespace: inputs.namespace,
        Type: inputs.type,
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
