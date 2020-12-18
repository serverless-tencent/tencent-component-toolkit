const { ApiFactory } = require('../../utils/api');

const ACTIONS = [
  'CreateClusters',
  'DescribeClusterDetail',
  'IsolateCluster',
  'OfflineCluster',
  'OfflineInstance',
  'DescribeInstances',
  'DescribeInstanceDetail',
  'DescribeAccounts',
  'ResetAccountPassword',
  'DescribeClusters',
  'DescribeServerlessInstanceSpecs',
];

const APIS = ApiFactory({
  // debug: true,
  serviceType: 'cynosdb',
  version: '2019-01-07',
  actions: ACTIONS,
});

module.exports = APIS;
