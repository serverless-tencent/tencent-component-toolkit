import Scf from '../scf';
import { TriggerManager } from './manager';
import { CapiCredentials, RegionType } from './../interface';
import BaseTrigger, { TRIGGER_STATUS_MAP } from './base';
import { TimerTriggerInputsParams, TriggerInputs, CreateTriggerReq } from './interface';

export default class TimerTrigger extends BaseTrigger<TimerTriggerInputsParams> {
  constructor({ credentials, region }: { credentials: CapiCredentials; region: RegionType }) {
    super();
    this.credentials = credentials;
    this.region = region;
  }

  getKey(triggerInputs: CreateTriggerReq) {
    // Very strange logical for Enable, fe post Enable is 'OPEN' or 'CLOSE'
    // but get 1 or 0, parameter type cnaged......
    const Enable = TRIGGER_STATUS_MAP[triggerInputs.Enable!];
    // Very strange logical for TriggerDesc, fe post TriggerDesc is "0 */6 * * * * *"
    // but get "{"cron":"0 */6 * * * * *"}"
    const Desc =
      triggerInputs.TriggerDesc?.indexOf('cron') !== -1
        ? triggerInputs.TriggerDesc
        : JSON.stringify({
            cron: triggerInputs.TriggerDesc,
          });
    return `${triggerInputs.Type}-${triggerInputs.TriggerName}-${Desc}-${triggerInputs.CustomArgument}-${Enable}-${triggerInputs.Qualifier}`;
  }

  formatInputs({
    inputs,
  }: {
    region: RegionType;
    inputs: TriggerInputs<TimerTriggerInputsParams>;
  }) {
    const { parameters, name } = inputs;
    const triggerInputs: CreateTriggerReq = {
      Action: 'CreateTrigger',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,
      Type: 'timer',
      Qualifier: parameters?.qualifier || '$DEFAULT',
      TriggerName: parameters?.name || name,
      TriggerDesc: parameters?.cronExpression,
      Enable: (parameters?.enable ? 'OPEN' : 'CLOSE') as 'OPEN' | 'CLOSE',

      CustomArgument: parameters?.argument ?? undefined,
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
    inputs: TriggerInputs<TimerTriggerInputsParams>;
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
    inputs: TriggerInputs<TimerTriggerInputsParams>;
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
