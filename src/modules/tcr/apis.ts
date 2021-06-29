import { ApiFactory } from '../../utils/api';
import { ApiServiceType } from '../interface';

const ACTIONS = [
  // 查询实例信息
  'DescribeInstances',
  // 查询仓库信息
  'DescribeRepositories',
  // 查询镜像信息
  'DescribeImages',
  // 获取个人版镜像详情
  'DescribeImagePersonal',
] as const;

export type ActionType = typeof ACTIONS[number];

const APIS = ApiFactory({
  // debug: true,
  serviceType: ApiServiceType.tcr,
  version: '2019-09-24',
  actions: ACTIONS,
});

export default APIS;
