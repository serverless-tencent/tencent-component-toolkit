const { ApiError } = require('../../../utils/error');

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
          throw new ApiError({
            type: `API_CFS_${action}`,
            message: `${Response.Error.Message} (reqId: ${Response.RequestId})`,
            reqId: Response.RequestId,
            code: Response.Error.Code,
          });
        }
        return Response;
      } catch (e) {
        throw new ApiError({
          type: `API_CFS_${action}`,
          message: e.message,
          stack: e.stack,
          reqId: e.reqId,
          code: e.code,
        });
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
