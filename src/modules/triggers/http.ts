import Scf from '../scf';
import { TriggerManager } from './manager';
import { CapiCredentials, RegionType } from './../interface';
import BaseTrigger from './base';
import { HttpTriggerInputsParams, TriggerInputs, CreateTriggerReq,TriggerAction } from './interface';
import { caseForObject } from '../../utils';
import { getScfTriggerByName } from './utils';

export default class HttpTrigger extends BaseTrigger<HttpTriggerInputsParams> {
  credentials: CapiCredentials;
  region: RegionType;

  constructor({ credentials, region }: { credentials: CapiCredentials; region: RegionType }) {
    super();
    this.credentials = credentials;
    this.region = region;
  }

  getKey(triggerInputs: CreateTriggerReq) {
    return `http-${triggerInputs?.TriggerName}`;
  }

  formatInputs({ inputs,action = 'CreateTrigger' }: { region: RegionType; inputs: TriggerInputs<HttpTriggerInputsParams> ,action?: TriggerAction}) {
    const { parameters } = inputs;
    const triggerName = parameters?.name || 'url-trigger';
    const { origins,headers,methods,exposeHeaders } =  parameters?.corsConfig || {}
    const triggerInputs: CreateTriggerReq = {
      Action: action,
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,
      Type: 'http',
      Qualifier: parameters?.qualifier || '$DEFAULT',
      TriggerName: triggerName,
      TriggerDesc: JSON.stringify({
        AuthType: parameters?.authType || 'NONE',
        NetConfig: {
          EnableIntranet: parameters?.netConfig?.enableIntranet ?? false,
          EnableExtranet: parameters?.netConfig?.enableExtranet ?? false,
        },
        CorsConfig: parameters?.corsConfig ? caseForObject({
          ...parameters?.corsConfig,
          origins: typeof origins === 'string' ? origins?.split(',') : origins,
          methods: typeof methods === 'string' ? methods?.split(',') : methods,
          headers: typeof headers === 'string' ? headers?.split(',') : headers,
          exposeHeaders: typeof exposeHeaders === 'string' ? exposeHeaders?.split(',') : exposeHeaders,
        },'upper') : undefined
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
    // 查询当前触发器是否已存在
    const existTrigger = await getScfTriggerByName({ scf, region, inputs });
    // 更新触发器
    if (existTrigger) {
      const { triggerInputs } = this.formatInputs({ region, inputs, action: 'UpdateTrigger' });
      console.log(`${triggerInputs.Type} trigger ${triggerInputs.TriggerName} is exist`)
      console.log(`Updating ${triggerInputs.Type} trigger ${triggerInputs.TriggerName}`);
      try {
          // 更新触发器
          await scf.request(triggerInputs);
          // 更新成功后，查询最新的触发器信息
          const trigger = await getScfTriggerByName({ scf, region, inputs });
          return trigger;
      } catch (error) {
        return {}
      }
    } else { // 创建触发器
      const { triggerInputs } = this.formatInputs({ region, inputs });
      console.log(`Creating ${triggerInputs.Type} trigger ${triggerInputs.TriggerName}`);
      const { TriggerInfo } = await scf.request(triggerInputs);
      TriggerInfo.Qualifier = TriggerInfo.Qualifier || triggerInputs.Qualifier;
      return TriggerInfo;
    }
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
