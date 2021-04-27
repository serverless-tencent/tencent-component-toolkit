import { RegionType, TagInput } from './../interface';
export interface VpcDeployInputs {
  region?: RegionType;
  zone: string;
  vpcName: string;
  subnetName: string;

  cidrBlock?: string;
  enableMulticast?: boolean;
  dnsServers?: string[];
  domainName?: string;
  tags?: TagInput[];
  subnetTags?: TagInput[];
  enableSubnetBroadcast?: boolean;

  vpcId?: string;
  subnetId?: string;
}

export interface VpcRemoveInputs {
  vpcId: string;
  subnetId: string;
}

export interface Tag {
  Key: string;
  Value: string;
}

export interface DefaultVpcItem {
  VpcId: string;
  SubnetId: string;
  VpcName: string;
  SubnetName: string;
  CidrBlock: string;
  DhcpOptionsId: string;
  DnsServerSet: string[];
  DomainName: string;
}
export interface VpcItem {
  VpcId: string;
  VpcName: string;
  CidrBlock: string;
  Ipv6CidrBlock: string;
  IsDefault: boolean;
  EnableMulticast: boolean;
  EnableDhcp: boolean;
  CreatedTime: string;
  DhcpOptionsId: string;
  DnsServerSet: string[];
  DomainName: string;
  TagSet: { Key: string; Value: string }[];
  AssistantCidrSet: any[];
}
export interface SubnetItem {
  NetworkAclId: string;
  RouteTableId: string;
  VpcId: string;
  EnableBroadcast: boolean;
  Zone: string;
  Ipv6CidrBlock: string;
  AvailableIpAddressCount: number;
  IsRemoteVpcSnat: boolean;
  SubnetName: string;
  TotalIpAddressCount: number;
  TagSet: { Key: string; Value: string }[];
  CreatedTime: string;
  SubnetId: string;
  CidrBlock: string;
  IsDefault: boolean;
}

export interface VpcOutputs {
  region: string;
  zone: string;
  vpcId: string;
  vpcName: string;
  subnetId: string;
  subnetName: string;

  tags?: TagInput[];
}
