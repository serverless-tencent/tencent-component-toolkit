const { waitResponse } = require('@ygkit/request');
const { TypeError } = require('../../../utils/error');
const {
  CreateCfsFileSystem,
  DescribeCfsFileSystems,
  UpdateCfsFileSystemName,
  UpdateCfsFileSystemPGroup,
  UpdateCfsFileSystemSizeLimit,
  DeleteCfsFileSystem,
  // DescribeMountTargets,
  DeleteMountTarget,
} = require('./apis');

const TIMEOUT = 5 * 60 * 1000;

const apis = {
  async getCfs(capi, FileSystemId) {
    try {
      const {
        FileSystems: [detail],
      } = await DescribeCfsFileSystems(capi, {
        FileSystemId,
      });
      if (detail && detail.FileSystemId) {
        return detail;
      }
    } catch (e) {}
    return undefined;
  },

  async createCfs(capi, params) {
    const res = await CreateCfsFileSystem(capi, params);

    const detail = await waitResponse({
      callback: async () => this.getCfs(capi, res.FileSystemId),
      targetProp: 'LifeCycleState',
      targetResponse: 'available',
      timeout: TIMEOUT,
    });
    return detail;
  },

  async deleteMountTarget(capi, FileSystemId, MountTargetId) {
    try {
      await DeleteMountTarget(capi, {
        FileSystemId,
        MountTargetId,
      });
    } catch (e) {
      throw new TypeError(
        'API_CFS_DeleteMountTarget',
        `Delete mouted target ${MountTargetId} for cfs ${FileSystemId} failed`,
        e.stack,
        e.reqId,
      );
    }
  },

  async deleteCfs(capi, FileSystemId) {
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
    const { RequestId } = await DeleteCfsFileSystem(capi, {
      FileSystemId,
    });
    try {
      await waitResponse({
        callback: async () => this.getCfs(capi, FileSystemId),
        targetResponse: undefined,
        timeout: TIMEOUT,
      });
    } catch (e) {
      throw new TypeError(
        'API_CFS_DeleteCfsFileSystem',
        `Delete cfs ${FileSystemId} failed`,
        null,
        RequestId,
      );
    }
  },

  async updateCfs(capi, FileSystemId, params) {
    // update fs name
    if (params.fsName) {
      await UpdateCfsFileSystemName(capi, {
        FileSystemId,
        FsName: params.fsName,
      });
    }
    // update priority group
    if (params.pGroupId) {
      await UpdateCfsFileSystemPGroup(capi, {
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
      await UpdateCfsFileSystemSizeLimit(capi, {
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

module.exports = apis;
