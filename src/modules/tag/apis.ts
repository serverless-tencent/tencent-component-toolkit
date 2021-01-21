import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

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
  serviceType: ApiServiceType.tag,
  version: '2018-08-13',
  actions: ACTIONS,
});

export default APIS;
