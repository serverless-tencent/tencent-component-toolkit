function HttpError(code, message, reqId) {
  this.code = code || 0;
  this.message = reqId ? `${reqId}, ${message || ''}` : message || '';
}

HttpError.prototype = Error.prototype;

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
          throw new HttpError(Response.Error.Code, Response.Error.Message, Response.RequestId);
        }
        return Response;
      } catch (e) {
        throw new HttpError(500, e.message);
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
