const { ApiFactory } = require('../../utils/api');
const { ApiError } = require('../../utils/error');

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

const APIS = ApiFactory({
  debug: true,
  serviceType: 'apigateway',
  version: '2018-08-08',
  actions: ACTIONS,
  responseHandler(Response) {
    return Response.Result || Response;
  },
  errorHandler(action, Response) {
    if (Response.Error.Code.indexOf('ResourceNotFound') === -1) {
      throw new ApiError({
        type: `API_APIGW_${action}`,
        message: `${Response.Error.Message} (reqId: ${Response.RequestId})`,
        reqId: Response.RequestId,
        code: Response.Error.Code,
      });
    }
    return null;
  },
});

module.exports = APIS;
