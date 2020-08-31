const { ApiFactory } = require('../../utils/api');

const ACTIONS = [
  'CreateFunction',
  'DeleteFunction',
  'GetFunction',
  'UpdateFunctionCode',
  'UpdateFunctionConfiguration',
  'CreateTrigger',
  'DeleteTrigger',
  'PublishVersion',
  'CreateAlias',
  'UpdateAlias',
  'GetAlias',
  'Invoke',
];

const APIS = ApiFactory({
  // debug: true,
  serviceType: 'scf',
  version: '2018-04-16',
  actions: ACTIONS,
});

module.exports = APIS;
