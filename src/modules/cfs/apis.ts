import { ApiServiceType } from '../interface';
import { ApiFactory } from '../../utils/api';

const ACTIONS = [
  'CreateCfsFileSystem',
  'DescribeCfsFileSystems',
  'UpdateCfsFileSystemName',
  'UpdateCfsFileSystemPGroup',
  'UpdateCfsFileSystemSizeLimit',
  'DeleteCfsFileSystem',
  'DescribeMountTargets',
  'DeleteMountTarget',
] as const;

export type ActionType = typeof ACTIONS[number];

/** 文件存储服务 (CFS) APIS */
const APIS = ApiFactory({
  // debug: true,
  serviceType: ApiServiceType.cfs,
  version: '2019-07-19',
  actions: ACTIONS,
});

export default APIS;
