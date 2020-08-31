const { ApiFactory } = require('../../utils/api');

const ACTIONS = [
  'CreateDefaultVpc',
  'CreateVpc',
  'DeleteVpc',
  'DescribeVpcs',
  'CreateSubnet',
  'DeleteSubnet',
  'DescribeSubnets',
  'ModifyVpcAttribute',
  'ModifySubnetAttribute',
];

const APIS = ApiFactory({
  // debug: true,
  serviceType: 'vpc',
  version: '2017-03-12',
  actions: ACTIONS,
});

module.exports = APIS;
