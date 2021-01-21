import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = [
  'DescribeRoleList',
  'ListAttachedRolePolicies',
  'AttachRolePolicy',
  'CreateRole',
  'GetRole',
  'DeleteRole',
];

const APIS = ApiFactory({
  // debug: true,
  serviceType: ApiServiceType.cam,
  version: '2019-01-16',
  actions: ACTIONS,
});

export default APIS;