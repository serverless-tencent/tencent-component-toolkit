import { RegionType } from './../interface';
export interface LayerDeployInputs {
  name?: string;
  bucket?: string;
  object?: string;

  description?: string;
  runtimes?: string[];

  region?: RegionType;

  version?: number;
}

export interface LayerRemoveInputs {
  name: string;
  version: number;
}
