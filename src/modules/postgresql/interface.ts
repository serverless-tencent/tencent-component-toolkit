import { VpcConfig } from './../cynosdb/interface';
import { RegionType } from './../interface';
export interface PostgresqlDeployInputs {
  region?: RegionType;
  zone?: string;
  projectId?: number;
  dBInstanceName?: string;
  dBInstanceId?: string;
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
  dBInstanceId?: string;
}

export interface PostgresqlInstanceNetInfo {
  Address: string;
  Ip: string;
  NetType: string;
  Port: number;
  Status: string;
}

export interface PostgresqlInstanceDetail {
  CreateTime: string;
  DBAccountSet: {
    DBConnLimit: number;
    DBPassword: string;
    DBUser: string;
  }[];
  DBCharset: string;
  DBDatabaseList: string[];
  DBInstanceId: string;
  DBInstanceName: string;
  DBInstanceNetInfo: PostgresqlInstanceNetInfo[];
  DBInstanceStatus: string;
  DBVersion: string;
  ProjectId: number;
  Region: string;
  SubnetId: string;
  TagList: any[];
  VpcId: string;
  Zone: string;
}
