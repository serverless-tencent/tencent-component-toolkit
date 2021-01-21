import { ApiFactory } from '../../utils/api';
import { ApiError } from '../../utils/error';
import { ApiServiceType } from '../interface';

export const SCF = ApiFactory({
  // debug: true,
  serviceType: ApiServiceType.scf,
  version: '2018-04-16',
  actions: ['CreateTrigger', 'DeleteTrigger', 'ListTriggers'] as const,
});

export const APIGW = ApiFactory({
  // debug: true,
  serviceType: ApiServiceType.apigateway,
  version: '2018-08-08',
  actions: ['DescribeApi'] as const,
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

export const MPS = ApiFactory({
  // debug: true,
  isV3: false,
  serviceType: ApiServiceType.mps,
  version: '2019-06-12',
  actions: ['BindTrigger', 'UnbindTrigger'] as const,
});