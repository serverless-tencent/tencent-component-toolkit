const { ApiFactory } = require('../../utils/api');

const ACTIONS = [
  'CreateServerlessDBInstance',
  'DescribeServerlessDBInstances',
  'DeleteServerlessDBInstance',
  'OpenServerlessDBExtranetAccess',
  'CloseServerlessDBExtranetAccess',
  'UpdateCdnConfig',
];

const APIS = ApiFactory({
  // debug: true,
  serviceType: 'postgres',
  version: '2017-03-12',
  actions: ACTIONS,
});

export default APIS;
