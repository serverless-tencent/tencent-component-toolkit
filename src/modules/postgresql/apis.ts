import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = [
  'CreateServerlessDBInstance',
  'DescribeServerlessDBInstances',
  'DeleteServerlessDBInstance',
  'OpenServerlessDBExtranetAccess',
  'CloseServerlessDBExtranetAccess',
  'UpdateCdnConfig',
] as const;

const APIS = ApiFactory({
  // debug: true,
  serviceType: ApiServiceType.postgres,
  version: '2017-03-12',
  actions: ACTIONS,
});

export default APIS;
