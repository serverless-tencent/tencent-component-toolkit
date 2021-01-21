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
];
const APIS = ApiFactory({
  // debug: true,
  serviceType: ApiServiceType.vpc,
  version: '2017-03-12',
  actions: ACTIONS,
});

export default APIS;

