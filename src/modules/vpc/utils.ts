import { Capi } from '@tencent-sdk/capi';
import { deepClone } from '../../utils';
import APIS from './apis';

const utils = {
  /**
   *
   * @param {object} capi capi instance
   * @param {string} vpcId
   */
  async getVpcDetail(capi: Capi, vpcId: string) {
    // get instance detail
    try {
      const res = await APIS.DescribeVpcs(capi, {
        VpcIds: [vpcId],
      });
      if (res.VpcSet) {
        const {
          VpcSet: [detail],
        } = res;
        return detail;
      }
      return null;
    } catch (e) {
      console.log(e);
      return null;
    }
  },

  /**
   *
   * @param {object} capi capi instance
   * @param {string} vpcId
   */
  async getSubnetDetail(capi: Capi, subnetId: string) {
    try {
      const res = await APIS.DescribeSubnets(capi, {
        SubnetIds: [subnetId],
      });
      if (res.SubnetSet) {
        const {
          SubnetSet: [detail],
        } = res;
        return detail;
      }
      return null;
    } catch (e) {
      console.log(e);
      return null;
    }
  },

  async createVpc(capi: Capi, inputs: {
    VpcName: string;
    EnableMulticast?: boolean;
    DnsServers?: string[];
    DomainName?: string;
    VpcId?: string;
  }) {
    // clean undefined
    inputs = deepClone(inputs);
    const res = await APIS.CreateVpc(capi, inputs);
    if (res.Vpc && res.Vpc.VpcId) {
      const { Vpc } = res;
      return Vpc;
    }
  },

  async modifyVpc(
    capi: Capi,
    inputs: {
      VpcName: string;
      EnableMulticast?: boolean;
      DnsServers?: string[];
      DomainName?: string;
      VpcId?: string;
    },
  ) {
    // clean undefined
    inputs = deepClone(inputs);
    await APIS.ModifyVpcAttribute(capi, inputs);
  },

  async deleteVpc(capi: Capi, vpcId: string) {
    await APIS.DeleteVpc(capi, {
      VpcId: vpcId,
    });
  },

  async createSubnet(capi: Capi, inputs: any) {
    // clean undefined
    inputs = deepClone(inputs);
    const res = await APIS.CreateSubnet(capi, inputs);
    if (res.Subnet && res.Subnet.SubnetId) {
      const { Subnet } = res;
      return Subnet;
    }
  },

  async modifySubnet(capi: Capi, inputs: any) {
    // clean undefined
    inputs = deepClone(inputs);
    await APIS.ModifySubnetAttribute(capi, inputs);
  },

  async deleteSubnet(capi: Capi, subnetId: string) {
    await APIS.DeleteSubnet(capi, {
      SubnetId: subnetId,
    });
  },
};

export default utils;
