import { RegionType, CapiCredentials, ApiServiceType } from './../interface';

import { Capi } from '@tencent-sdk/capi';
import { waitResponse } from '@ygkit/request';
import utils from './utils';
import { ApiError } from '../../utils/error';
import { LayerDeployInputs } from './interface';

// timeout 2 minutes
const TIMEOUT = 2 * 60 * 1000;

export default class Layer {
  capi: Capi;
  region: RegionType;
  credentials: CapiCredentials;

  constructor(credentials: CapiCredentials = {}, region: RegionType = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.scf,
      SecretId: credentials.SecretId!,
      SecretKey: credentials.SecretKey!,
      Token: credentials.Token,
    });
  }

  async getLayerDetail(name: string, version: number) {
    try {
      const detail = await utils.getLayerDetail(this.capi, name, version);
      return detail;
    } catch (e) {
      return null;
    }
  }

  /** 部署层 */
  async deploy(inputs: LayerDeployInputs = {}) {
    const outputs = {
      region: this.region,
      name: inputs.name,
      bucket: inputs.bucket,
      object: inputs.object,
      description: inputs.description,
      runtimes: inputs.runtimes,
      version: undefined as number | undefined,
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
    const version = await utils.publishLayer(this.capi, layerInputs);
    // loop for active status
    try {
      await waitResponse({
        callback: async () => this.getLayerDetail(inputs.name!, version),
        targetProp: 'Status',
        targetResponse: 'Active',
        failResponse: ['PublishFailed'],
        timeout: TIMEOUT,
      });
    } catch (e) {
      const detail = e.response;
      if (detail) {
        // if not active throw error
        if (detail.Status !== 'Active') {
          let errMsg = '';
          if (e.message.indexOf('TIMEOUT') !== -1) {
            errMsg = `Cannot create layer success in 2 minutes, status: ${detail.Status} (reqId: ${detail.RequestId})`;
          } else {
            errMsg = `Publish layer fail, status: ${detail.Status} (reqId: ${detail.RequestId})`;
          }
          throw new ApiError({
            type: 'API_LAYER_GetLayerVersion',
            message: errMsg,
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

  /** 删除层 */
  async remove(inputs: LayerDeployInputs = {}) {
    try {
      console.log(`Start removing layer: ${inputs.name}, version: ${inputs.version}`);
      await utils.deleteLayerVersion(this.capi, inputs.name!, inputs.version!);
      console.log(`Remove layer: ${inputs.name}, version: ${inputs.version} success`);
    } catch (e) {
      console.log(e);
    }

    return true;
  }
}

module.exports = Layer;
