import { RegionType } from './../interface';
export interface VpcDeployInputs {
  region?: RegionType;
  zone: string;
  vpcName: string;
  subnetName: string;

  cidrBlock?: string;
  enableMulticast?: boolean;
  dnsServers?: string[];
  domainName?: string;
  tags?: string[];
  subnetTags?: string[];
  enableSubnetBroadcast?: boolean;

  vpcId?: string;
  subnetId?: string;
}

export interface VpcRemoveInputs {
  vpcId: string;
  subnetId: string;
}
