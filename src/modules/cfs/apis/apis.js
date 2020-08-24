const { TypeError } = require('../../../utils/error');

function apiFactory(actions) {
  const apis = {};
  actions.forEach((action) => {
    apis[action] = async (capi, inputs) => {
      const data = {
        Version: '2019-07-19',
        Action: action,
        ...inputs,
      };
      try {
        const { Response } = await capi.request(
          data,
          // this is preset options for capiateway
          {
            debug: false,
            ServiceType: 'cfs',
            // baseHost: 'tencentcloudapi.com'
            host: 'cfs.tencentcloudapi.com',
          },
          false,
        );

        if (Response && Response.Error && Response.Error.Code) {
          throw new TypeError(
            `API_CFS_${action}`,
            `${Response.Error.Code}: ${Response.Error.Message} ${Response.RequestId}`,
            null,
            Response.RequestId,
          );
        }
        return Response;
      } catch (e) {
        throw new TypeError(`API_CFS_${action}`, e.message, e.stack, e.reqId);
      }
    };
  });

  return apis;
}

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
const APIS = apiFactory(ACTIONS);

module.exports = APIS;
