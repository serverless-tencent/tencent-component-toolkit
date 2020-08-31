const { ApiFactory } = require('../../utils/api');
const { ApiError } = require('../../utils/error');

const ACTIONS = ['RecordList', 'RecordModify', 'RecordCreate', 'RecordStatus', 'RecordDelete'];

const APIS = ApiFactory({
  // debug: true,
  isV3: false,
  serviceType: 'cns',
  host: 'cns.api.qcloud.com',
  path: '/v2/index.php',
  version: '2018-06-06',
  actions: ACTIONS,
  customHandler(action, res) {
    if (res.code !== 0) {
      throw new ApiError({
        type: `API_CNS_${action.toUpperCase()}`,
        code: res.code,
        message: res.message,
      });
    }
    return res.data;
  },
});

module.exports = APIS;
