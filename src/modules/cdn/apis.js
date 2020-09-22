const { ApiFactory } = require('../../utils/api');

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
];

const APIS = ApiFactory({
  // debug: true,
  isV3: true,
  serviceType: 'cdn',
  version: '2018-06-06',
  actions: ACTIONS,
});

module.exports = APIS;
