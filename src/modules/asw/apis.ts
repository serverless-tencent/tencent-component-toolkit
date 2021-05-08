import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = [
  'DescribeFlowServices',
  'DescribeFlowServiceDetail',
  'CreateFlowService',
  'ModifyFlowService',
  'DeleteFlowService',
  'StartExecution',
  'DescribeExecution',
  'StopExecution',
] as const;

export type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory({
  debug: false,
  isV3: true,
  serviceType: ApiServiceType.asw,
  version: '2020-07-22',
  actions: ACTIONS,
});

export default APIS;
