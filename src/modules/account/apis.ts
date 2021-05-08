import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = ['DescribeCurrentUserDetails'] as const;

export type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory({
  // debug: true,
  serviceType: ApiServiceType.account,
  version: '2018-12-25',
  actions: ACTIONS,
});

export default APIS;
