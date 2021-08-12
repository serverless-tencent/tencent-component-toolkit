import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = [
  'CreateEventBus',
  'UpdateEventBus',
  'DeleteEventBus',
  'ListEventBuses',
  'GetEventBus',
  'GetAccountLimit',
  'PutEvent',
  'CreateConnection',
  'UpdateConnection',
  'DeleteConnection',
  'ListConnections',
  'GetConnection',
  'CreateRule',
  'UpdateRule',
  'DeleteRule',
  'ListRules',
  'GetRule',
  'CreateTarget',
  'DeleteTarget',
  'ListTargets',
] as const;

export type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory({
  debug: true,
  serviceType: ApiServiceType.eb,
  version: '2021-04-16',
  actions: ACTIONS,
});

export default APIS;
