const { Capi } = require('@tencent-sdk/capi');
const Cos = require('../cos');
const apis = require('./apis');

class Layer {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.capi = new Capi({
      Region: region,
      SecretId: credentials.SecretId,
      SecretKey: credentials.SecretKey,
      Token: credentials.Token,
    });
    this.cosClient = new Cos(credentials, region);
  }
  async checkExist(name) {
    const res = await apis.getLayerDetail(this.capi, name);
    return !!res.LayerVersion;
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
    console.log(`Created layer: ${inputs.name}, version: ${version} successful`);
    outputs.version = version;

    return outputs;
  }

  async remove(inputs = {}) {
    try {
      console.log(`Start removing layer: ${inputs.name}, version: ${inputs.version}...`);
      await apis.deleteLayerVersion(this.capi, inputs.name, inputs.version);
      console.log(`Remove layer: ${inputs.name}, version: ${inputs.version} successfully`);
    } catch (e) {
      console.log(e);
    }

    return {};
  }
}

module.exports = Layer;
