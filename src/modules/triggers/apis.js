const { ApiFactory } = require('../../utils/api');
const { ApiError } = require('../../utils/error');

const SCF = ApiFactory({
  // debug: true,
  serviceType: 'scf',
  version: '2018-04-16',
  actions: ['CreateTrigger', 'DeleteTrigger', 'ListTriggers'],
});

const APIGW = ApiFactory({
  // debug: true,
  serviceType: 'apigateway',
  version: '2018-08-08',
  actions: ['DescribeApi'],
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

const MPS = ApiFactory({
  // debug: true,
  isV3: false,
  serviceType: 'mps',
  version: '2019-06-12',
  actions: ['BindTrigger', 'UnbindTrigger'],
});

module.exports = {
  SCF,
  APIGW,
  MPS,
};
