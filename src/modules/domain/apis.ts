import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = ['CheckDomain'] as const;

const APIS = ApiFactory({
  // debug: true,
  serviceType: ApiServiceType.domain,
  version: '2018-08-08',
  actions: ACTIONS,
});

export type ActionType = typeof ACTIONS[number];

export default APIS;
