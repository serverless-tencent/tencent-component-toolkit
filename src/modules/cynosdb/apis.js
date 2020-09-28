const { ApiFactory } = require('../../utils/api');

const ACTIONS = [
  'CreateClusters',
  'DescribeClusterDetail',
  'IsolateCluster',
  'DescribeAccounts',
  'ResetAccountPassword',
];

const APIS = ApiFactory({
  // debug: true,
  serviceType: 'cynosdb',
  version: '2019-01-07',
  actions: ACTIONS,
});

module.exports = APIS;
