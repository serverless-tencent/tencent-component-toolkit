import { RegionType } from './../interface';
import { CreateCfsParams } from './utils';
import { CapiCredentials, ApiServiceType } from '../interface';

import { Capi } from '@tencent-sdk/capi';
import utils from './utils';
import Tag from '../tag/index';
import { CFSDeployInputs, CFSDeployOutputs, CFSRemoveInputs } from './interface';

export default class CFS {
  region: RegionType;
  credentials: CapiCredentials;
  capi: Capi;
  tagClient: Tag;

  constructor(credentials: CapiCredentials, region: RegionType = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.cfs,
      SecretId: credentials.SecretId!,
      SecretKey: credentials.SecretKey!,
      Token: credentials.Token,
    });

    this.tagClient = new Tag(this.credentials, this.region);
  }

  async deploy(inputs: CFSDeployInputs) {
    const cfsInputs: CreateCfsParams = {
      Zone: inputs.zone,
      FsName: inputs.fsName,
      PGroupId: inputs.pGroupId || 'pgroupbasic',
      NetInterface: inputs.netInterface || 'VPC',
      Protocol: inputs.protocol || 'NFS',
      StorageType: inputs.storageType || 'SD',
      VpcId: '',
      SubnetId: '',
    };

    const outputs: CFSDeployOutputs = {
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
      const detail = await utils.getCfs(this.capi, inputs.fileSystemId);
      // update it
      if (detail) {
        exist = true;
        const updateParams: {
          pGroupId?: string;
          fsName?: string;
          fsLimit?: number;
        } = {};
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
          await utils.updateCfs(this.capi, inputs.fileSystemId, updateParams);
          console.log(`Update CFS id: ${inputs.fileSystemId}, name: ${inputs.fsName} success.`);
        } else {
          console.log(
            `CFS ${inputs.fileSystemId}, name: ${inputs.fsName} already exist, nothing to update`,
          );
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
      const { FileSystemId } = await utils.createCfs(this.capi, cfsInputs);
      console.log(`Created CFS ${inputs.fsName}, id ${FileSystemId} successful`);
      outputs.fileSystemId = FileSystemId;
    }

    try {
      const { tags = [] } = inputs;
      await this.tagClient.deployResourceTags({
        tags: tags.map((item) => ({ TagKey: item.key, TagValue: item.value })),
        serviceType: ApiServiceType.cfs,
        resourcePrefix: 'filesystem',
        resourceId: outputs.fileSystemId!,
      });

      if (tags.length > 0) {
        outputs.tags = tags;
      }
    } catch (e) {
      console.log(`[TAG] ${e.message}`);
    }

    return outputs;
  }

  async remove(inputs: CFSRemoveInputs) {
    try {
      console.log(`Start removing CFS ${inputs.fsName}, id ${inputs.fileSystemId}...`);
      await utils.deleteCfs(this.capi, inputs.fileSystemId);
      console.log(`Remove CFS ${inputs.fsName}, id ${inputs.fileSystemId} successfully`);
    } catch (e) {
      console.log(e);
    }

    return {};
  }
}
