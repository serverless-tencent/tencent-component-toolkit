import { ScfRemoveInputs } from './../scf/interface';
import { ScfDeployInputs, ScfDeployOutputs } from './../scf/interface';
import { RegionType } from "../interface";

export type MultiScfDeployInputs =  {
    region?: RegionType;
} & Partial<Record<RegionType, ScfDeployInputs>>;

export type MultiScfDeployOutputs = {

} & Partial<Record<RegionType, ScfDeployOutputs>>;

export type MultiScfRemoveInputs = Partial<Record<RegionType, ScfRemoveInputs>>;