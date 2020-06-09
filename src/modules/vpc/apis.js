const { TypeError } = require('../../utils/error');

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
            ServiceType: 'vpc',
            host: 'vpc.tencentcloudapi.com',
          },
          false,
        );
        if (Response && Response.Error && Response.Error.Code) {
          throw new TypeError(
            `API_VPC_${action}`,
            Response.Error.Message,
            null,
            Response.RequestId,
          );
        }
        return Response;
      } catch (e) {
        throw new TypeError(`API_VPC_${action}`, e.message, e.stack);
      }
    };
  });

  return apis;
}

const ACTIONS = [
  'CreateDefaultVpc',
  'CreateVpc',
  'DeleteVpc',
  'DescribeVpcs',
  'CreateSubnet',
  'DeleteSubnet',
  'DescribeSubnets',
  'ModifyVpcAttribute',
  'ModifySubnetAttribute',
];
const APIS = apiFactory(ACTIONS);

module.exports = APIS;
