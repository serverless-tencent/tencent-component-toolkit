const { ApiError } = require('../../utils/error');

function isEmpty(val) {
  return val === undefined || val === null || (typeof val === 'number' && isNaN(val));
}

function cleanEmptyValue(obj) {
  const newObj = {};
  for (const key in obj) {
    const val = obj[key];
    if (!isEmpty(val)) {
      newObj[key] = val;
    }
  }
  return newObj;
}

function apiFactory(actions) {
  const apis = {};
  actions.forEach((action) => {
    apis[action] = async (capi, inputs) => {
      inputs = cleanEmptyValue(inputs);
      try {
        const { Response } = await capi.request(
          {
            Action: action,
            Version: '2018-08-08',
            // RequestClient: 'ServerlessComponent',
            Token: capi.options.Token || null,
            ...inputs,
          },
          {
            debug: false,
            ServiceType: 'apigateway',
            host: 'apigateway.tencentcloudapi.com',
          },
          false,
        );

        if (Response && Response.Error && Response.Error.Code) {
          if (Response.Error.Code.indexOf('ResourceNotFound') === -1) {
            throw new ApiError({
              type: `API_APIGW_${action}`,
              message: `${Response.Error.Message} (reqId: ${Response.RequestId})`,
              reqId: Response.RequestId,
              code: Response.Error.Code,
            });
          }
          return null;
        }
        return Response.Result || Response;
      } catch (e) {
        throw new ApiError({
          type: `API_APIGW_${action}`,
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
  'CreateService',
  'DeleteService',
  'ModifyService',
  'DescribeService',
  'ReleaseService',
  'UnReleaseService',
  'CreateApi',
  'DescribeApi',
  'DeleteApi',
  'ModifyApi',
  'DescribeApisStatus',
  'CreateUsagePlan',
  'DescribeApiUsagePlan',
  'DescribeUsagePlanSecretIds',
  'DescribeUsagePlan',
  'DeleteUsagePlan',
  'ModifyUsagePlan',
  'CreateApiKey',
  'DeleteApiKey',
  'DisableApiKey',
  'EnableApiKey',
  'DescribeApiKeysStatus',
  'BindSecretIds',
  'UnBindSecretIds',
  'BindEnvironment',
  'UnBindEnvironment',
  'DescribeServiceSubDomains',
  'BindSubDomain',
  'UnBindSubDomain',
];
const APIS = apiFactory(ACTIONS);

module.exports = APIS;
