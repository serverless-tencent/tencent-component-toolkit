import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = [
  'CreateRule',
  'DeleteRule',
  'DescribeListeners',
  'RegisterFunctionTargets',
  'ModifyFunctionTargets',
  'DescribeTaskStatus',
] as const;

export type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory({
  // debug: true,
  isV3: false,
  serviceType: ApiServiceType.clb,
  version: '2018-03-17',
  actions: ACTIONS,
});

export default APIS;
