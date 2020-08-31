const { ApiFactory } = require('../../utils/api');

const ACTIONS = [
  'AddCdnDomain',
  'DescribeDomains',
  'UpdateDomainConfig',
  'StopCdnDomain',
  'DeleteCdnDomain',
  'PushUrlsCache',
  'PurgeUrlsCache',
  'PurgePathCache',
];

const APIS = ApiFactory({
  // debug: true,
  serviceType: 'cdn',
  version: '2018-06-06',
  actions: ACTIONS,
});

module.exports = APIS;
