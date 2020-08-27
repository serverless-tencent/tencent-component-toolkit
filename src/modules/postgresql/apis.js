const { ApiError } = require('../../utils/error');

function apiFactory(actions) {
  const apis = {};
  actions.forEach((action) => {
    apis[action] = async (apig, inputs) => {
      const data = {
        Version: '2017-03-12',
        Action: action,
        RequestClient: 'ServerlessComponent',
        ...inputs,
      };
      if (apig.options.Token) {
        data.Token = apig.options.Token;
      }
      try {
        const { Response } = await apig.request(
          data,
          // this is preset options for apigateway
          {
            debug: false,
            ServiceType: 'postgres',
            // baseHost: 'tencentcloudapi.com'
            host: 'postgres.tencentcloudapi.com',
          },
          false,
        );
        if (Response && Response.Error && Response.Error.Code) {
          throw new ApiError({
            type: `API_POSTGRESQL_${action}`,
            message: `${Response.Error.Message} (reqId: ${Response.RequestId})`,
            reqId: Response.RequestId,
            code: Response.Error.Code,
          });
        }
        return Response;
      } catch (e) {
        throw new ApiError({
          type: `API_POSTGRESQL_${action}`,
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
  'CreateServerlessDBInstance',
  'DescribeServerlessDBInstances',
  'DeleteServerlessDBInstance',
  'OpenServerlessDBExtranetAccess',
  'CloseServerlessDBExtranetAccess',
  'UpdateCdnConfig',
];
const APIS = apiFactory(ACTIONS);

module.exports = APIS;
