import { Capi } from '@tencent-sdk/capi';
import { deepClone } from '.';
import { ApiServiceType } from '../modules/interface';
import { ApiError } from './error';

function isEmpty(val: any) {
  return val === undefined || val === null || (typeof val === 'number' && isNaN(val));
}

function cleanEmptyValue(obj : any) {
  const newObj:any = {};
  for (const key in obj) {
    const val = obj[key];
    if (!isEmpty(val)) {
      newObj[key] = val;
    }
  }
  return newObj;
}

interface ApiFactoryOptions<ACTIONS_T> {
  serviceType: ApiServiceType,
  version: string,
  actions: ACTIONS_T,
  
  debug?: boolean,
  isV3?: boolean,
  host?: string,
  path?: string,
  customHandler?: (action:string, res:any) => any,
  responseHandler?: (res:any) => any,
  errorHandler?: (action:string, res:any) => any
}

export function ApiFactory<ACTIONS_T extends readonly string[]>({
  debug = false,
  isV3 = false,
  actions,
  serviceType,
  host,
  path,
  version,
  customHandler,
  responseHandler = (res:any) => res,
  errorHandler,
}: ApiFactoryOptions<ACTIONS_T>) {
  const APIS:Record<ACTIONS_T[number], (capi: Capi, inputs: any) => any> = {} as any;
  actions.forEach((action:ACTIONS_T[number]) => {
    APIS[action] = async (capi:Capi, inputs:any) => {
      inputs = deepClone(inputs)
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

  return APIS;
}