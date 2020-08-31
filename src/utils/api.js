const { ApiError } = require('./error');

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

function ApiFactory({
  debug = false,
  isV3 = true,
  actions,
  serviceType,
  host,
  path,
  version,
  customHandler,
  responseHandler = (res) => res,
  errorHandler,
}) {
  const apis = {};
  actions.forEach((action) => {
    apis[action] = async (capi, inputs) => {
      const reqData = cleanEmptyValue({
        Action: action,
        Version: version,
        ...inputs,
      });
      inputs = cleanEmptyValue(inputs);
      try {
        const res = await capi.request(reqData, {
          isV3: isV3,
          debug: debug,
          RequestClient: 'ServerlessComponentV2',
          ServiceType: serviceType,
          host: host || `${serviceType}.tencentcloudapi.com`,
          path: path || '/',
        });
        // Customize response handler
        if (customHandler) {
          return customHandler(action, res);
        }
        const { Response } = res;
        if (Response && Response.Error && Response.Error.Code) {
          if (errorHandler) {
            return errorHandler(action, Response);
          }
          throw new ApiError({
            type: `API_${serviceType.toUpperCase()}_${action}`,
            message: `${Response.Error.Message} (reqId: ${Response.RequestId})`,
            reqId: Response.RequestId,
            code: Response.Error.Code,
          });
        }
        return responseHandler(Response);
      } catch (e) {
        throw new ApiError({
          type: `API_${serviceType.toUpperCase()}_${action}`,
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

module.exports = {
  ApiFactory,
};
