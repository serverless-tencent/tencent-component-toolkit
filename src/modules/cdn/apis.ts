import { ApiFactory } from '../../utils/api';
import { ServiceType } from '../interface';

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

type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory<typeof ACTIONS>({
  // debug: true,
  isV3: true,
  serviceType: ServiceType.cdn,
  version: '2018-06-06',
  actions: ACTIONS,
});

export default APIS;
