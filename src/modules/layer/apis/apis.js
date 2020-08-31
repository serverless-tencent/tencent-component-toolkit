const { ApiFactory } = require('../../../utils/api');

const ACTIONS = [
  'PublishLayerVersion',
  'DeleteLayerVersion',
  'GetLayerVersion',
  'ListLayers',
  'ListLayerVersions',
];

const APIS = ApiFactory({
  // debug: true,
  serviceType: 'scf',
  version: '2018-04-16',
  actions: ACTIONS,
});

module.exports = APIS;
