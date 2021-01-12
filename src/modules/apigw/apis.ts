import { ApiFactory } from '../../utils/api';
import { ApiError } from '../../utils/error';
import { ServiceType } from '../interface';

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
  'DescribeServiceUsagePlan',
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
] as const;

export type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory({
  // debug: true,
  serviceType: ServiceType.apigateway,
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

export default APIS;
