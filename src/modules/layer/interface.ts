import { RegionType } from './../interface';
export interface LayerDeployInputs {
    name?: string;
    bucket?: string;
    object?: string;

    description?: string;
    runtimes?: string[];

    region?: RegionType;

    version?: string;
}

export interface LayerRemoveInputs {
    name: string;
    version: string;

}