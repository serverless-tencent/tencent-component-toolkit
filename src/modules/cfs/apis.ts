import { ServiceType } from '../interface';
import { ApiFactory } from "../../utils/api";


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

/** 文件存储服务 (CFS) APIS */
const APIS = ApiFactory({
  // debug: true,
  serviceType: ServiceType.cfs,
  version: '2019-07-19',
  actions: ACTIONS,
});

export default APIS;
