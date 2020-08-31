const { ApiFactory } = require('../../../utils/api');

const ACTIONS = [
  'CreateCfsFileSystem',
  'DescribeCfsFileSystems',
  'UpdateCfsFileSystemName',
  'UpdateCfsFileSystemPGroup',
  'UpdateCfsFileSystemSizeLimit',
  'DeleteCfsFileSystem',
  'DescribeMountTargets',
  'DeleteMountTarget',
];

const APIS = ApiFactory({
  // debug: true,
  serviceType: 'cfs',
  version: '2019-07-19',
  actions: ACTIONS,
});

module.exports = APIS;
