const { ApiError } = require('../../../utils/error');

function apiFactory(actions) {
  const apis = {};
  actions.forEach((action) => {
    apis[action] = async (capi, inputs) => {
      const data = {
        Version: '2018-04-16',
        Action: action,
        // RequestClient: 'ServerlessComponent',
        ...inputs,
      };
      try {
        const { Response } = await capi.request(
          data,
          // this is preset options for capiateway
          {
            debug: false,
            ServiceType: 'scf',
            // baseHost: 'tencentcloudapi.com'
            host: 'scf.tencentcloudapi.com',
          },
          true,
        );

        if (Response && Response.Error && Response.Error.Code) {
          throw new ApiError({
            type: `API_LAYER_${action}`,
            message: `${Response.Error.Message} (reqId: ${Response.RequestId})`,
            reqId: Response.RequestId,
            code: Response.Error.Code,
          });
        }
        return Response;
      } catch (e) {
        throw new ApiError({
          type: `API_LAYER_${action}`,
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
  'PublishLayerVersion',
  'DeleteLayerVersion',
  'GetLayerVersion',
  'ListLayers',
  'ListLayerVersions',
];
const APIS = apiFactory(ACTIONS);

module.exports = APIS;
