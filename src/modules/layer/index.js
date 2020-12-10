const { Capi } = require('@tencent-sdk/capi');
const { waitResponse } = require('@ygkit/request');
const capis = require('./apis/apis');
const apis = require('./apis');
const { ApiError } = require('../../utils/error');

// timeout 2 minutes
const TIMEOUT = 2 * 60 * 1000;

class Layer {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      SecretId: credentials.SecretId,
      SecretKey: credentials.SecretKey,
      Token: credentials.Token,
    });
  }

  async request({ Action, ...data }) {
    const result = await capis[Action](this.capi, data);
    return result;
  }

  async getLayerDetail(name, version) {
    try {
      const detail = await apis.getLayerDetail(this.capi, name, version);
      return detail;
    } catch (e) {
      return null;
    }
  }

  async deploy(inputs = {}) {
    const outputs = {
      region: this.region,
      name: inputs.name,
      bucket: inputs.bucket,
      object: inputs.object,
      description: inputs.description,
      runtimes: inputs.runtimes,
    };

    const layerInputs = {
      Content: {
        CosBucketName: inputs.bucket,
        CosObjectName: inputs.object,
      },
      Description: inputs.description,
      Region: inputs.region,
      CompatibleRuntimes: inputs.runtimes,
      LayerName: inputs.name,
    };

    // publish layer
    console.log(`Creating layer ${inputs.name}`);
    const version = await apis.publishLayer(this.capi, layerInputs);
    // loop for active status
    try {
      await waitResponse({
        callback: async () => this.getLayerDetail(inputs.name, version),
        targetProp: 'Status',
        targetResponse: 'Active',
        timeout: TIMEOUT,
      });
    } catch (e) {
      const detail = await this.getLayerDetail(inputs.name, version);
      if (detail) {
        // if not active throw error
        if (detail.Status !== 'Active') {
          throw new ApiError({
            type: 'API_LAYER_GetLayerVersion',
            message: `Cannot create layer success in 2 minutes, status: ${detail.Status}(reqId: ${detail.RequestId})`,
          });
        }
      } else {
        // if can not get detail throw error
        throw new ApiError({
          type: 'API_LAYER_GetLayerVersion',
          message: `Cannot create layer success in 2 minutes`,
        });
      }
    }
    console.log(`Created layer: ${inputs.name}, version: ${version} success`);
    outputs.version = version;

    return outputs;
  }

  async remove(inputs = {}) {
    try {
      console.log(`Start removing layer: ${inputs.name}, version: ${inputs.version}`);
      await apis.deleteLayerVersion(this.capi, inputs.name, inputs.version);
      console.log(`Remove layer: ${inputs.name}, version: ${inputs.version} success`);
    } catch (e) {
      console.log(e);
    }

    return true;
  }
}

module.exports = Layer;
