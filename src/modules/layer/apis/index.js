const {
  PublishLayerVersion,
  DeleteLayerVersion,
  GetLayerVersion,
  ListLayerVersions,
} = require('./apis');

const utils = {
  /**
   * get target version layer detail
   * @param {object} capi capi instance
   * @param {string} LayerName
   * @param {string} LayerVersion
   */
  async getLayerDetail(capi, LayerName, LayerVersion) {
    // get instance detail
    try {
      const res = await GetLayerVersion(capi, {
        LayerName,
        LayerVersion,
      });
      return res;
    } catch (e) {
      return null;
    }
  },

  /**
   * get layer versiosn
   * @param {object} capi capi instance
   * @param {string} LayerName
   */
  async getLayerVersions(capi, LayerName) {
    // get instance detail
    const res = await ListLayerVersions(capi, {
      LayerName,
    });
    if (res.LayerVersions) {
      const { LayerVersions } = res;
      return LayerVersions;
    }
    return null;
  },

  /**
   *
   * @param {object} capi capi instance
   * @param {object} params publish layer parameters
   */
  async publishLayer(capi, params) {
    const res = await PublishLayerVersion(capi, {
      LayerName: params.LayerName,
      CompatibleRuntimes: params.CompatibleRuntimes,
      Content: params.Content,
      Description: params.Description,
      LicenseInfo: params.licenseInfo || '',
    });
    return res.LayerVersion ? res.LayerVersion : null;
  },

  /**
   * delete layer version
   * @param {object} capi capi instance
   * @param {*} LayerName layer name
   * @param {*} LayerVersion layer version
   */
  async deleteLayerVersion(capi, LayerName, LayerVersion) {
    await DeleteLayerVersion(capi, {
      LayerName,
      LayerVersion,
    });
  },
};

module.exports = utils;
