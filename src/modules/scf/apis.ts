import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = [
  'CreateFunction',
  'DeleteFunction',
  'GetFunction',
  'UpdateFunctionCode',
  'UpdateFunctionConfiguration',
  'GetFunctionEventInvokeConfig',
  'UpdateFunctionEventInvokeConfig',
  'CreateTrigger',
  'DeleteTrigger',
  'PublishVersion',
  'ListVersionByFunction',
  'ListAliases',
  'CreateAlias',
  'UpdateAlias',
  'DeleteAlias',
  'GetAlias',
  'Invoke',
  'ListTriggers',
  'GetDemoAddress',
  'PutReservedConcurrencyConfig',
  'PutProvisionedConcurrencyConfig',
  'DeleteProvisionedConcurrencyConfig',
  'GetReservedConcurrencyConfig',
  'GetProvisionedConcurrencyConfig',
  'GetRequestStatus',
  'PutGpuReservedQuota',
] as const;

export type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory({
  // debug: true,
  serviceType: ApiServiceType.scf,
  version: '2018-04-16',
  actions: ACTIONS,
});

export default APIS;
