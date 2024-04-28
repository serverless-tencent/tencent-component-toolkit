import { RegionType, CapiCredentials, ApiServiceType } from './../interface';
import { Capi } from '@tencent-sdk/capi';
import utils from './utils';
import { ApiTypeError } from '../../utils/error';
import { VpcDeployInputs, VpcRemoveInputs, VpcOutputs } from './interface';
import TagClient from '../tag';

export default class Vpc {
  region: RegionType;
  credentials: CapiCredentials;
  capi: Capi;
  tagClient: TagClient;

  constructor(credentials: CapiCredentials = {}, region: RegionType = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.vpc,
      SecretId: credentials.SecretId!,
      SecretKey: credentials.SecretKey!,
      Token: credentials.Token,
    });

    this.tagClient = new TagClient(this.credentials, this.region);
  }

  async deploy(inputs: VpcDeployInputs) {
    const {
      zone,
      vpcName,
      subnetName,
      cidrBlock,
      enableMulticast,
      dnsServers,
      domainName,
      tags,
      subnetTags,
      enableSubnetBroadcast,
    } = inputs;

    let { vpcId, subnetId } = inputs;

    const handleVpc = async (vId: string) => {
      let existVpc = false;
      if (vId) {
        const detail = await utils.getVpcDetail(this.capi, vId);
        if (detail) {
          existVpc = true;
        }
      }
      const params = {
        VpcName: vpcName,
        EnableMulticast: enableMulticast,
        DnsServers: dnsServers,
        DomainName: domainName,
        VpcId: undefined as string | undefined,
      };

      /** 修改旧的 Vpc */
      if (existVpc) {
        console.log(`Updating vpc ${vId}...`);
        params.VpcId = vId;
        await utils.modifyVpc(this.capi, params);
        console.log(`Update vpc ${vId} success`);
      } else {
        /** 添加新的 Vpc */
        if (!cidrBlock) {
          throw new ApiTypeError('PARAMETER_VPC', 'cidrBlock is required');
        }

        console.log(`Creating vpc ${vpcName}...`);
        const res = await utils.createVpc(this.capi, {
          ...params,
          ...{ CidrBlock: cidrBlock },
        });
        console.log(`Create vpc ${vpcName} success.`);
        vId = res.VpcId;
      }

      const formateTags = this.tagClient.formatInputTags(tags as any);
      if (formateTags) {
        try {
          await this.tagClient.deployResourceTags({
            tags: formateTags.map(({ key, value }) => ({ TagKey: key, TagValue: value })),
            resourceId: vId,
            serviceType: ApiServiceType.vpc,
            resourcePrefix: 'vpc',
          });
        } catch (e) {
          console.log(`[TAG] ${e.message}`);
        }
      }

      return vId;
    };

    // check subnetId
    const handleSubnet = async (vId: string, sId: string) => {
      let existSubnet = false;
      if (sId) {
        const detail = await utils.getSubnetDetail(this.capi, sId);
        if (detail) {
          existSubnet = true;
        }
      }
      const params = {
        SubnetName: subnetName,
        SubnetId: undefined as string | undefined,
        EnableBroadcast: undefined as boolean | undefined,
        Zone: undefined as string | undefined,
        VpcId: undefined as string | undefined,
        CidrBlock: undefined as string | undefined,
      };

      /** 子网已存在 */
      if (existSubnet) {
        console.log(`Updating subnet ${sId}...`);
        params.SubnetId = sId;
        params.EnableBroadcast = enableSubnetBroadcast;

        await utils.modifySubnet(this.capi, params);
        console.log(`Update subnet ${sId} success.`);
      } else {
        /** 子网不存在 */
        if (vId) {
          console.log(`Creating subnet ${subnetName}...`);
          params.Zone = zone;
          params.VpcId = vId;
          params.CidrBlock = cidrBlock;

          const res = await utils.createSubnet(this.capi, params);
          sId = res.SubnetId;

          if (enableSubnetBroadcast === true) {
            await utils.modifySubnet(this.capi, {
              SubnetId: sId,
              EnableBroadcast: enableSubnetBroadcast,
            });
          }
          console.log(`Create subnet ${subnetName} success.`);
        }
      }

      const subnetTagList = this.tagClient.formatInputTags((subnetTags ? subnetTags : tags) as any);
      if (subnetTagList) {
        try {
          await this.tagClient.deployResourceTags({
            tags: subnetTagList.map(({ key, value }) => ({ TagKey: key, TagValue: value })),
            resourceId: sId,
            serviceType: ApiServiceType.vpc,
            resourcePrefix: 'subnet',
          });
        } catch (e) {
          console.log(`[TAG] ${e.message}`);
        }
      }
      return sId;
    };

    if (vpcName) {
      vpcId = await handleVpc(vpcId!);
    }

    if (subnetName) {
      subnetId = await handleSubnet(vpcId!, subnetId!);
    }

    const outputs: VpcOutputs = {
      region: this.region,
      zone,
      vpcId: vpcId!,
      vpcName,
      subnetId: subnetId!,
      subnetName,
    };

    if (tags && tags.length > 0) {
      outputs.tags = tags;
    }

    return outputs;
  }

  async remove(inputs: VpcRemoveInputs) {
    const { vpcId, subnetId } = inputs;
    if (subnetId) {
      console.log(`Start removing subnet ${subnetId}`);
      try {
        await utils.deleteSubnet(this.capi, subnetId);
      } catch (e) {
        console.log(e);
      }
      console.log(`Removed subnet ${subnetId}`);
    }
    if (vpcId) {
      console.log(`Start removing vpc ${vpcId}`);
      try {
        await utils.deleteVpc(this.capi, vpcId);
      } catch (e) {
        console.log(e);
      }
      console.log(`Removed vpc ${vpcId}`);
    }

    return {};
  }
}
