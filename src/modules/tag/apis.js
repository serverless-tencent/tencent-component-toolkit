const { ApiFactory } = require('../../utils/api');

const ACTIONS = ['ModifyResourceTags'];

const APIS = ApiFactory({
  // debug: true,
  serviceType: 'tag',
  version: '2018-08-13',
  actions: ACTIONS,
});

module.exports = APIS;
