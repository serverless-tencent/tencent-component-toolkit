import { Region } from 'cos-nodejs-sdk-v5';
import { RegionType } from './../interface';

export type MultiApigwDeployInputs =  {
    region: RegionType[] | RegionType;
    serviceId: string;
} & Record<RegionType, any>;

export type MultiApigwDeployOutputs = Record<RegionType, any>;

export type MultiApigwRemoveInputs = Record<RegionType, any>;