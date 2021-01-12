import { ApiFactory } from '../../utils/api';
import { ServiceType } from '../interface';

const ACTIONS = [
  'CreateClusters',
  'DescribeClusterDetail',
  'IsolateCluster',
  'OfflineCluster',
  'OfflineInstance',
  'DescribeInstances',
  'DescribeInstanceDetail',
  'DescribeAccounts',
  'ResetAccountPassword',
  'DescribeClusters',
  'DescribeServerlessInstanceSpecs',
  'OpenWan',
  'CloseWan',
  'DescribeClusterInstanceGrps',
] as const;
const APIS = ApiFactory({
  // debug: true,
  serviceType: ServiceType.cynosdb,
  version: '2019-01-07',
  actions: ACTIONS,
});


export default APIS;