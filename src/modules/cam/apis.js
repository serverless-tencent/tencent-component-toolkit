const { ApiFactory } = require('../../utils/api');

const ACTIONS = [
  'DescribeRoleList',
  'ListAttachedRolePolicies',
  'AttachRolePolicy',
  'CreateRole',
  'GetRole',
  'DeleteRole',
];

const APIS = ApiFactory({
  // debug: true,
  serviceType: 'cam',
  version: '2019-01-16',
  actions: ACTIONS,
});

module.exports = APIS;
