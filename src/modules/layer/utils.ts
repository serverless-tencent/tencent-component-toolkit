import { Capi } from '@tencent-sdk/capi';
import APIS from './apis';

const utils = {
  /**
   * get target version layer detail
   * @param {object} capi capi instance
   * @param {string} LayerName
   * @param {string} LayerVersion
   */
  async getLayerDetail(capi: Capi, LayerName: string, LayerVersion: string) {
    // get instance detail
    try {
      const res = await APIS.GetLayerVersion(capi, {
        LayerName,
        LayerVersion,
      });
      return res;
    } catch (e) {
      return null;
    }
  },

  /**
   * 获取层版本
   * @param {object} capi capi instance
   * @param {string} LayerName
   */
  async getLayerVersions(capi: Capi, LayerName: string): Promise<{} | null> {
    // get instance detail
    const res = await APIS.ListLayerVersions(capi, {
      LayerName,
    });
    if (res.LayerVersions) {
      const { LayerVersions } = res;
      return LayerVersions;
    }
    return null;
  },

  /**
   * 部署层
   * @param {object} capi capi instance
   * @param {object} params publish layer parameters
   */
  async publishLayer(
    capi: Capi,
    params: {
      LayerName?: string;
      CompatibleRuntimes?: string[];
      Content: {
        CosBucketName?: string;
        CosObjectName?: string;
      };
      Description?: string;
      licenseInfo?: string;
    },
  ) {
    const res = await APIS.PublishLayerVersion(capi, {
      LayerName: params.LayerName,
      CompatibleRuntimes: params.CompatibleRuntimes,
      Content: params.Content,
      Description: params.Description,
      LicenseInfo: params.licenseInfo ?? '',
    });
    return res.LayerVersion ? res.LayerVersion : null;
  },

  /**
   * 删除层的指定版本
   * @param {object} capi capi instance
   * @param {*} LayerName layer name
   * @param {*} LayerVersion layer version
   */
  async deleteLayerVersion(capi: Capi, LayerName: string, LayerVersion: string) {
    await APIS.DeleteLayerVersion(capi, {
      LayerName,
      LayerVersion,
    });
  },
};

export default utils;
