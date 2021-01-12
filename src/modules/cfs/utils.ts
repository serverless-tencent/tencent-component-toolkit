import { Capi } from '@tencent-sdk/capi';
import { waitResponse } from '@ygkit/request';
import { ApiTypeError } from '../../utils/error';
import APIS from './apis';

const TIMEOUT = 5 * 60 * 1000;

export interface CreateCfsParams {
  Zone: string;
  FsName: string;
  PGroupId: string;
  NetInterface: string;
  Protocol: string;
  StorageType: string;
  VpcId?: string;
  SubnetId?: string;
  MountIP?: string;
}

const apis = {
  async getCfs(capi: Capi, FileSystemId:string) {
    try {
      const {
        FileSystems: [detail],
      } = await APIS.DescribeCfsFileSystems(capi, {
        FileSystemId,
      });
      if (detail && detail.FileSystemId) {
        return detail;
      }
    } catch (e) {}
    return undefined;
  },

  async createCfs(capi: Capi, params:CreateCfsParams) {
    const res = await APIS.CreateCfsFileSystem(capi, params);

    const detail = await waitResponse({
      callback: async () => this.getCfs(capi, res.FileSystemId),
      targetProp: 'LifeCycleState',
      targetResponse: 'available',
      timeout: TIMEOUT,
    });
    return detail;
  },

  async deleteMountTarget(capi:Capi, FileSystemId:string, MountTargetId:string) {
    try {
      await APIS.DeleteMountTarget(capi, {
        FileSystemId,
        MountTargetId,
      });
    } catch (e) {
      throw new ApiTypeError(
        'API_CFS_DeleteMountTarget',
        `Delete mouted target ${MountTargetId} for cfs ${FileSystemId} failed`,
        e.stack,
        e.reqId,
      );
    }
  },

  async deleteCfs(capi: Capi, FileSystemId: string) {
    // TODO: now not support delete mount target
    // const { MountTargets } = await DescribeMountTargets(capi, {
    //   FileSystemId,
    // });
    // console.log('MountTargets', MountTargets);
    // // 1. delete all mount target
    // if (MountTargets && MountTargets.length > 0) {
    //   for (let i = 0; i < MountTargets.length; i++) {
    //     await this.deleteMountTarget(capi, FileSystemId, MountTargets[i].MountTargetId);
    //   }
    // }
    // 2. delete cfs and wait for it
    const { RequestId } = await APIS.DeleteCfsFileSystem(capi, {
      FileSystemId,
    });
    try {
      await waitResponse({
        callback: async () => this.getCfs(capi, FileSystemId),
        targetResponse: undefined,
        timeout: TIMEOUT,
      });
    } catch (e) {
      throw new ApiTypeError(
        'API_CFS_DeleteCfsFileSystem',
        `Delete cfs ${FileSystemId} failed`,
        undefined,
        RequestId,
      );
    }
  },

  async updateCfs(capi: Capi, FileSystemId: string, params: any) {
    // update fs name
    if (params.fsName) {
      await APIS.UpdateCfsFileSystemName(capi, {
        FileSystemId,
        FsName: params.fsName,
      });
    }
    // update priority group
    if (params.pGroupId) {
      await APIS.UpdateCfsFileSystemPGroup(capi, {
        FileSystemId,
        PGroupId: params.pGroupId,
      });

      await waitResponse({
        callback: async () => this.getCfs(capi, FileSystemId),
        targetProp: 'LifeCycleState',
        targetResponse: 'available',
        timeout: TIMEOUT,
      });
    }
    // update fs storage limit
    if (params.fsLimit) {
      await APIS.UpdateCfsFileSystemSizeLimit(capi, {
        FileSystemId,
        FsLimit: params.fsLimit,
      });

      await waitResponse({
        callback: async () => this.getCfs(capi, FileSystemId),
        targetProp: 'LifeCycleState',
        targetResponse: 'available',
        timeout: TIMEOUT,
      });
    }
  },
};

export default apis;