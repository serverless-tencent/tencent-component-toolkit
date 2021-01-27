import { VpcConfig } from './../cynosdb/interface';
import { RegionType } from './../interface';
export interface PostgresqlDeployInputs {
  region?: RegionType;
  zone?: string;
  projectId?: number;
  dBInstanceName?: string;
  dBVersion?: string;
  dBCharset?: string;
  extranetAccess?: boolean;
  vpcConfig?: VpcConfig;
}

export interface PostgresqlUrl {
  connectionString: string;
  host?: string;
  port: string;
  user: string;
  password: string;
  dbname: string;
}

export interface PostgresqlDeployOutputs {
  region?: RegionType;
  zone?: string;
  vpcConfig?: VpcConfig;
  dBInstanceName?: string;
  dBInstanceId?: string;
  private?: PostgresqlUrl;
  public?: PostgresqlUrl;
}

export interface PostgresqlRemoveInputs {
  dBInstanceName?: string;
}
