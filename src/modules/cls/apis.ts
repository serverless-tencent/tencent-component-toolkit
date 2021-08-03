import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = [
  'CreateAlarm',
  'ModifyAlarm',
  'DescribeAlarms',
  'DeleteAlarm',
  'CreateAlarmNotice',
  'ModifyAlarmNotice',
  'DeleteAlarmNotice',
  'DescribeAlarmNotices',
] as const;

export type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory({
  debug: false,
  isV3: true,
  serviceType: ApiServiceType.cls,
  version: '2020-10-16',
  actions: ACTIONS,
});

export default APIS;
