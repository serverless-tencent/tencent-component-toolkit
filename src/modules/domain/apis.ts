import { ApiFactory } from '../../utils/api';
import { ServiceType } from '../interface';

const ACTIONS = ['CheckDomain'];

const APIS = ApiFactory({
  // debug: true,
  serviceType: ServiceType.domain,
  version: '2018-08-08',
  actions: ACTIONS,
});

export default APIS;
