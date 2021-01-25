import { ApigwRemoveInputs } from './../apigw/interface';
import { RegionType } from './../interface';

export type MultiApigwDeployInputs = {
  region?: RegionType[] | RegionType;
  serviceId?: string;
} & Record<RegionType, {}>;

export type MultiApigwDeployOutputs = Record<RegionType, {}>;

export type MultiApigwRemoveInputs = Record<RegionType, ApigwRemoveInputs>;
