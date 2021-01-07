const { Capi } = require('@tencent-sdk/capi');
const apis = require('./apis');
const Tag = require('../tag/index');

class CFS {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      SecretId: credentials.SecretId,
      SecretKey: credentials.SecretKey,
      Token: credentials.Token,
    });

    this.tagClient = new Tag(this.credentials, this.region);
  }

  async deploy(inputs = {}) {
    const cfsInputs = {
      Zone: inputs.zone,
      FsName: inputs.fsName,
      PGroupId: inputs.pGroupId || 'pgroupbasic',
      NetInterface: inputs.netInterface || 'VPC',
      Protocol: inputs.protocol || 'NFS',
      StorageType: inputs.storageType || 'SD',
    };

    const outputs = {
      region: this.region,
      fsName: cfsInputs.FsName,
      pGroupId: cfsInputs.PGroupId,
      netInterface: cfsInputs.NetInterface,
      protocol: cfsInputs.Protocol,
      storageType: cfsInputs.StorageType,
    };

    // check cfs existance
    let exist = false;
    if (inputs.fileSystemId) {
      const detail = await apis.getCfs(this.capi, inputs.fileSystemId);
      // update it
      if (detail) {
        exist = true;
        const updateParams = {};
        if (inputs.pGroupId !== detail.PGroup.PGroupId) {
          updateParams.pGroupId = inputs.pGroupId;
        }
        if (inputs.fsName && inputs.fsName !== detail.FsName) {
          updateParams.fsName = inputs.fsName;
        }
        if (inputs.fsLimit !== undefined && inputs.fsLimit !== detail.SizeLimit) {
          updateParams.fsLimit = inputs.fsLimit;
        }
        // update cfs
        if (Object.keys(updateParams).length > 0) {
          console.log(`Updating CFS id: ${inputs.fileSystemId}, name: ${inputs.fsName}`);
          await apis.updateCfs(this.capi, inputs.fileSystemId, updateParams);
          console.log(`Update CFS id: ${inputs.fileSystemId}, name: ${inputs.fsName} success.`);
        }

        outputs.fileSystemId = inputs.fileSystemId;
      }
    }

    // if not exist, create cfs
    if (!exist) {
      if (inputs.netInterface === 'VPC') {
        cfsInputs.VpcId = inputs.vpc.vpcId;
        cfsInputs.SubnetId = inputs.vpc.subnetId;

        if (inputs.vpc.mountIP) {
          cfsInputs.MountIP = inputs.vpc.mountIP;
        }
      }

      console.log(`Creating CFS ${inputs.fsName}`);
      const { FileSystemId } = await apis.createCfs(this.capi, cfsInputs);
      console.log(`Created CFS ${inputs.fsName}, id ${FileSystemId} successful`);
      outputs.fileSystemId = FileSystemId;
    }

    if (inputs.tags) {
      try {
        const tags = await this.tagClient.deployResourceTags({
          tags: inputs.tags.map((item) => ({ TagKey: item.key, TagValue: item.value })),
          serviceType: 'cfs',
          resourcePrefix: 'filesystem',
          resourceId: outputs.fileSystemId,
        });

        outputs.tags = tags.map((item) => ({
          key: item.TagKey,
          value: item.TagValue,
        }));
      } catch (e) {
        console.log(`Deploy cfs tags error: ${e.message}`);
      }
    }

    return outputs;
  }

  async remove(inputs = {}) {
    try {
      console.log(`Start removing CFS ${inputs.fsName}, id ${inputs.fileSystemId}...`);
      await apis.deleteCfs(this.capi, inputs.fileSystemId);
      console.log(`Remove CFS ${inputs.fsName}, id ${inputs.fileSystemId} successfully`);
    } catch (e) {
      console.log(e);
    }

    return {};
  }
}

module.exports = CFS;
