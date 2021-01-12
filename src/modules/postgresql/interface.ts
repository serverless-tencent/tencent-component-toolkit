import { Region } from 'cos-nodejs-sdk-v5';
import { VpcConfig } from './../cynosdb/interface';
import { RegionType } from './../interface';
export interface PostgresqlDeployInputs {
  region: RegionType;
  zone: string;
  projectId: string;
  dBInstanceName: string;
  dBVersion: string;
  dBCharset: string;
  extranetAccess: string;
  vpcConfig: VpcConfig;
}

export interface PostgresqlDeployOutputs {
  region: RegionType;
  zone: string;
  vpcConfig: VpcConfig;
  dBInstanceName: string;
  dBInstanceId?: string;
  private?: string;
  public?:string;
}

export interface PostgresqlRemoveInputs {
    dBInstanceName: string;
}
