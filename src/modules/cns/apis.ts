import { ApiFactory } from '../../utils/api';
import { ApiError } from '../../utils/error';
import { ApiServiceType } from '../interface';

const ACTIONS = [
  'RecordList',
  'RecordModify',
  'RecordCreate',
  'RecordStatus',
  'RecordDelete',
] as const;

export type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory({
  // debug: true,
  isV3: false,
  serviceType: ApiServiceType.cns,
  host: 'cns.api.qcloud.com',
  path: '/v2/index.php',
  version: '2018-06-06',
  actions: ACTIONS,
  customHandler(action: any, res: any) {
    if (res.code !== 0) {
      throw new ApiError({
        type: `API_CNS_${action.toUpperCase()}`,
        code: res.code,
        message: res.message,
      });
    }
    return res.data;
  },
});

export default APIS;
