const { TypeError } = require('../../../utils/error');

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
      if (capi.options.Token) {
        data.Token = capi.options.Token;
      }
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
          throw new TypeError(
            `API_LAYER_${action}`,
            Response.Error.Message,
            null,
            Response.RequestId,
          );
        }
        return Response;
      } catch (e) {
        throw new TypeError(`API_LAYER_${action}`, e.message, e.stack);
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
