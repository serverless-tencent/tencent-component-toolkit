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
            Version: '2018-06-06',
            RequestClient: 'ServerlessComponent',
            Token: capi.options.Token || null,
            ...inputs,
          },
          {
            debug: false,
            ServiceType: 'cdn',
            host: 'cdn.tencentcloudapi.com',
          },
        );
        if (Response && Response.Error && Response.Error.Code) {
          throw new ApiError({
            type: `API_CDN_${action}`,
            message: `${Response.Error.Message} (reqId: ${Response.RequestId})`,
            reqId: Response.RequestId,
            code: Response.Error.Code,
          });
        }
        return Response;
      } catch (e) {
        throw new ApiError({
          type: `API_CDN_${action}`,
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
  'AddCdnDomain',
  'DescribeDomains',
  'UpdateDomainConfig',
  'StopCdnDomain',
  'DeleteCdnDomain',
  'PushUrlsCache',
  'PurgeUrlsCache',
  'PurgePathCache',
];
const APIS = apiFactory(ACTIONS);

module.exports = APIS;
