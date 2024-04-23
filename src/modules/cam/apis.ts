import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = [
  'DescribeRoleList',
  'ListAttachedRolePolicies',
  'AttachRolePolicy',
  'CreateRole',
  'GetRole',
  'DeleteRole',
  'GetUserAppId',
] as const;

export type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory({
  // debug: true,
  serviceType: ApiServiceType.cam,
  version: '2019-01-16',
  actions: ACTIONS,
});

export default APIS;
