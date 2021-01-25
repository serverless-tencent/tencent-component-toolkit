import { IndexRule } from '@tencent-sdk/cls/dist/typings';
import { RegionType } from './../interface';
export interface ClsDeployLogsetInputs {
  name: string;
  period: number;
  logsetId: string;
}

export interface ClsDeployTopicInputs {
  name: string;
  period: number;
  logsetId: string;
  topic: string;
  topicId: string;
}

export interface ClsDelopyIndexInputs {
  topicId: string;
  effective: boolean;
  rule?: IndexRule;
}

export interface ClsDeployInputs
  extends ClsDeployLogsetInputs,
    ClsDeployTopicInputs,
    ClsDelopyIndexInputs {
  name: string;
  topic: string;
}

export interface ClsDeployOutputs extends Partial<ClsDeployInputs> {
  region: RegionType;
}
