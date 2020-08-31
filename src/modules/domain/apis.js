const { ApiFactory } = require('../../utils/api');

const ACTIONS = ['CheckDomain'];

const APIS = ApiFactory({
  // debug: true,
  serviceType: 'domain',
  version: '2018-08-08',
  actions: ACTIONS,
});

module.exports = APIS;
