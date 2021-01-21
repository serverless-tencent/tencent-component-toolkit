import { Capi } from '@tencent-sdk/capi';
import { RegionType, CapiCredentials, ApiServiceType } from '../interface';
import { SCF } from './apis';
import { TriggerInputs, TriggerInputsParams, CreateTriggerReq } from './interface';
import Scf from '../scf';

type Qualifier = string;

export default abstract class BaseTrigger<P = TriggerInputsParams> {
  region!: RegionType;
  credentials: CapiCredentials = {};
  capi!: Capi;

  constructor(options?: {
    credentials?: CapiCredentials;
    region?: RegionType;
    serviceType: ApiServiceType;
  }) {
    if (options) {
      const { credentials = {}, region = 'ap-guangzhou', serviceType } = options;

      this.region = region;
      this.credentials = credentials;

      this.capi = new Capi({
        Region: region,
        ServiceType: serviceType,
        SecretId: credentials.SecretId!,
        SecretKey: credentials.SecretKey!,
      });
    }
  }

  abstract getKey(triggerType: CreateTriggerReq):string;

  abstract formatInputs({
    region,
    inputs,
  }: {
    region: RegionType;
    inputs: TriggerInputs<P>;
  }): {
    triggerKey: string;
    triggerInputs: P;
  };

  /** Get Trigger List */
  async getTriggerList({
    functionName,
    namespace = 'default',
    qualifier,
  }: {
    functionName?: string;
    namespace: string;
    qualifier: Qualifier;
  }) {
    const listOptions: {
      FunctionName?: string;
      Namespace: string;
      Limit: number;
      Filters: { Name: string; Values: Qualifier[] }[];
    } = {
      FunctionName: functionName,
      Namespace: namespace,
      Limit: 100,
      Filters: [],
    };
    if (qualifier) {
      listOptions.Filters = [
        {
          Name: 'Qualifier',
          Values: [qualifier],
        },
      ];
    }

    /** 获取 Api 的触发器列表 */
    const { Triggers, TotalCount } = await SCF.ListTriggers(this.capi, listOptions);

    // FIXME: 触发器最多只获取 100 个，理论上不会运行这部分逻辑
    if (TotalCount > 100) {
      const res: any[] = await this.getTriggerList({ functionName, namespace, qualifier });
      return Triggers.concat(res);
    }

    return Triggers;
  }

  abstract create({
    scf,
    region,
    inputs,
  }: {
    scf: Scf;
    region: string;
    inputs: TriggerInputs<P>;
  }): Promise<any>;

  /** delete scf trigger */
  abstract delete({
    scf,
    region: RegionType,
    inputs,
  }: {
    scf: Scf;
    region: RegionType,
    inputs: TriggerInputs<P>;
  }): Promise<boolean | { requestId: string; success: boolean }>;

  //   {
  //     console.log(`Removing ${inputs.Type} trigger ${inputs.TriggerName}`);
  //     try {
  //       await scf.request({
  //         Action: 'DeleteTrigger',
  //         FunctionName: funcInfo.FunctionName,
  //         Namespace: funcInfo.Namespace,
  //         Type: inputs.Type,
  //         TriggerDesc: inputs.TriggerDesc,
  //         TriggerName: inputs.TriggerName,
  //         Qualifier: inputs.Qualifier,
  //       });
  //       return true;
  //     } catch (e) {
  //       console.log(e);
  //       return false;
  //     }
  //   }
  // }
}

export const TRIGGER_STATUS_MAP = {
  OPEN: 'OPEN',
  CLOSE: 'CLOSE',
  1: 'OPEN',
  0: 'CLOSE',
};

export const CAN_UPDATE_TRIGGER = ['apigw', 'cls', 'mps'];
