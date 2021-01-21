import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = [
  'CreateDefaultVpc',
  'CreateVpc',
  'DeleteVpc',
  'DescribeVpcs',
  'CreateSubnet',
  'DeleteSubnet',
  'DescribeSubnets',
  'ModifyVpcAttribute',
  'ModifySubnetAttribute',
] as const;

export type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory({
  // debug: true,
  serviceType: ApiServiceType.vpc,
  version: '2017-03-12',
  actions: ACTIONS,
});

export default APIS;

