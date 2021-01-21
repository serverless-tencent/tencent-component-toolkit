import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = ['CheckDomain'];

const APIS = ApiFactory({
  // debug: true,
  serviceType: ApiServiceType.domain,
  version: '2018-08-08',
  actions: ACTIONS,
});

export default APIS;
