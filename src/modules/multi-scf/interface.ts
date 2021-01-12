import { ScfDeployInputs } from './../scf/interface';
import { Region } from 'cos-nodejs-sdk-v5';
import { RegionType } from "../interface";

export type MultiScfDeployInputs =  {
    region: RegionType;
} & Partial<Record<RegionType, ScfDeployInputs>>;

export type MultiScfRemoveInputs = Partial<Record<RegionType, ScfDeployInputs>>;