import { ApiServiceType } from './../interface';
import { FunctionInfo } from './../scf/interface';
import Scf from '../scf';
import { TriggerInputs, MpsTriggerInputsParams } from './interface';
import { MPS } from './apis';
import { pascalCaseProps } from '../../utils/index';
import BaseTrigger from './base';
import { CapiCredentials, RegionType } from '../interface';

export default class MpsTrigger extends BaseTrigger<MpsTriggerInputsParams> {
  constructor({
    credentials = {},
    region = 'ap-guangzhou',
  }: {
    credentials?: CapiCredentials;
    region?: RegionType;
  }) {
    super({region, credentials, serviceType: ApiServiceType.mps});
  }
  
  async request({ Action, ...data }: any) {
    const result = await MPS[Action](this.capi, pascalCaseProps(data));
    return result;
  }

  getKey(triggerInputs: { ResourceId?: string; TriggerDesc: { eventType: string } }) {
    if (triggerInputs.ResourceId) {
      // from ListTriggers API
      const rStrArr = triggerInputs.ResourceId.split('/');
      return `${rStrArr[rStrArr.length - 1]}`;
    }

    return `${triggerInputs.TriggerDesc.eventType}Event`;
  }

  formatInputs({ inputs }: { region?:RegionType, inputs: TriggerInputs<MpsTriggerInputsParams> }) {
    const data = inputs.parameters;
    const triggerInputs = {
      Type: 'mps',
      Qualifier: data.qualifier || '$DEFAULT',
      TriggerName: '',
      TriggerDesc: {
        eventType: data.type,
      },

      Enable: data.enable ? 'OPEN' : 'CLOSE',
    };

    const triggerKey = this.getKey(triggerInputs);

    return {
      triggerInputs,
      triggerKey,
    } as any;
  }

  async getTypeTrigger({
    eventType,
    functionName,
    namespace,
    qualifier,
  }: {
    eventType: string;
    functionName: string;
    namespace: string;
    qualifier: string;
  }) {
    const allList = await this.getTriggerList({
      functionName,
      namespace,
      qualifier,
    });
    const [exist] = allList.filter(
      (item: { ResourceId: string }) =>
        item.ResourceId.indexOf(`TriggerType/${eventType}Event`) !== -1,
    );
    if (exist) {
      return exist;
    }
    return null;
  }

  async create({ inputs }: { inputs: TriggerInputs<MpsTriggerInputsParams> }) {
    const parameters = inputs.parameters;
    const output = {
      namespace: inputs.namespace || 'default',
      functionName: inputs.functionName,
      ...parameters,
      resourceId: undefined as undefined | string,
    };
    // check exist type trigger
    const existTypeTrigger = await this.getTypeTrigger({
      eventType: parameters.type,
      qualifier: parameters.qualifier || '$DEFAULT',
      namespace: inputs.namespace || 'default',
      functionName: inputs.functionName,
    });
    let needBind = false;
    if (existTypeTrigger) {
      if (parameters.enable === false) {
        await this.request({
          Action: 'UnbindTrigger',
          Type: 'mps',
          Qualifier: parameters.qualifier || '$DEFAULT',
          FunctionName: inputs.functionName,
          Namespace: inputs.namespace || 'default',
          ResourceId: existTypeTrigger.ResourceId,
        });
      } else if (existTypeTrigger.BindStatus === 'off') {
        needBind = true;
      }
      output.resourceId = existTypeTrigger.ResourceId;
    } else {
      needBind = true;
    }

    if (needBind) {
      const res = await this.request({
        Action: 'BindTrigger',
        ScfRegion: this.region,
        EventType: parameters.type,
        Qualifier: parameters.qualifier || '$DEFAULT',
        FunctionName: inputs.functionName,
        Namespace: inputs.namespace || 'default',
      });

      output.resourceId = res.ResourceId;
    }

    return output;
  }

  async delete({ scf, inputs }: { scf: Scf; funcInfo?: FunctionInfo, inputs: TriggerInputs<MpsTriggerInputsParams> }) {
    console.log(`Removing ${inputs.type} trigger ${inputs.triggerName}`);
    try {
      const res = await scf.request({
        Action: 'DeleteTrigger',
        FunctionName: inputs.functionName,
        Namespace: inputs.namespace,
        Type: inputs.type,
        TriggerDesc: inputs.triggerDesc,
        TriggerName: inputs.triggerName,
        Qualifier: inputs.qualifier,
      });
      return {
        requestId: res.RequestId,
        success: true,
      };
    } catch (e) {
      // console.log(e);
      return false;
    }
  }
}
