import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = [
  'OpenCdnService',
  'AddCdnDomain',
  'DescribeDomains',
  'UpdateDomainConfig',
  'StartCdnDomain',
  'StopCdnDomain',
  'DeleteCdnDomain',
  'PushUrlsCache',
  'PurgeUrlsCache',
  'PurgePathCache',
] as const;

export type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory<typeof ACTIONS>({
  // debug: true,
  isV3: true,
  serviceType: ApiServiceType.cdn,
  version: '2018-06-06',
  actions: ACTIONS,
});

export default APIS;
