import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = ['GetMonitorData'] as const;

export type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory({
  debug: false,
  isV3: true,
  serviceType: ApiServiceType.monitor,
  version: '2018-07-24',
  actions: ACTIONS,
});

export default APIS;
