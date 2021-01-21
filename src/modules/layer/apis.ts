import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = [
  'PublishLayerVersion',
  'DeleteLayerVersion',
  'GetLayerVersion',
  'ListLayers',
  'ListLayerVersions',
] as const;

const APIS = ApiFactory({
  // debug: true,
  serviceType: ApiServiceType.scf,
  version: '2018-04-16',
  actions: ACTIONS,
});

export default APIS;
