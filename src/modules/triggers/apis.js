const { ApiFactory } = require('../../utils/api');
const { ApiError } = require('../../utils/error');

const SCF_ACTIONS = ['CreateTrigger', 'DeleteTrigger', 'ListTriggers'];
const APIGW_ACTIONS = ['DescribeApi'];

const SCF = ApiFactory({
  // debug: true,
  serviceType: 'scf',
  version: '2018-04-16',
  actions: SCF_ACTIONS,
});

const APIGW = ApiFactory({
  // debug: true,
  serviceType: 'apigateway',
  version: '2018-08-08',
  actions: APIGW_ACTIONS,
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

module.exports = {
  SCF,
  APIGW,
};
