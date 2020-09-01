const CONFIGS = {
  defaultNamespace: 'default',
  defaultMemorySize: 128,
  defaultTimeout: 3,
  defaultInitTimeout: 3,
  waitStatus: ['Creating', 'Updating', 'Publishing', 'Deleting'],
  failStatus: ['CreateFailed	', 'UpdateFailed', 'PublishFailed', 'DeleteFailed'],
};

module.exports = CONFIGS;
