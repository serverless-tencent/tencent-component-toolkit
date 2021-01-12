import { ApiFactory } from '../../utils/api';
import { ServiceType } from '../interface';

const ACTIONS = [
  'ModifyResourceTags',
  'DescribeResourceTags',
  'AttachResourcesTag',
  'DetachResourcesTag',
  'CreateTag',
  'DeleteTag',
  'DescribeTags',
  'DescribeResourceTagsByResourceIds',
];

export type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory({
  // debug: true,
  serviceType: ServiceType.tag,
  version: '2018-08-13',
  actions: ACTIONS,
});

export default APIS;
