import { Capi } from '@tencent-sdk/capi';
import { deepClone } from '../../utils';
import APIS from './apis';
import { VpcItem, SubnetItem, DefaultVpcItem } from './interface';

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

  async createVpc(
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

  async createSubnet(
    capi: Capi,
    inputs: {
      SubnetName: string;
      SubnetId?: string;
      EnableBroadcast?: boolean;
      Zone?: string;
      VpcId?: string;
      CidrBlock?: string;
      Tags?: string[];
    },
  ) {
    // clean undefined
    inputs = deepClone(inputs);
    const res = await APIS.CreateSubnet(capi, inputs);
    if (res.Subnet && res.Subnet.SubnetId) {
      const { Subnet } = res;
      return Subnet;
    }
  },

  async modifySubnet(
    capi: Capi,
    inputs: {
      SubnetName?: string;
      SubnetId?: string;
      EnableBroadcast?: boolean;
      Zone?: string;
      VpcId?: string;
      CidrBlock?: string;
      Tags?: string[];
    },
  ) {
    // clean undefined
    inputs = deepClone(inputs);
    await APIS.ModifySubnetAttribute(capi, inputs);
  },

  async deleteSubnet(capi: Capi, subnetId: string) {
    await APIS.DeleteSubnet(capi, {
      SubnetId: subnetId,
    });
  },

  /**
   * get default vpc
   * @param {object} capi capi instance
   * @param {string} vpcId
   */
  async getDefaultVpc(capi: Capi): Promise<VpcItem | null> {
    try {
      const res = await APIS.DescribeVpcs(capi, {
        Offset: 0,
        Limit: 100,
      });

      if (res.VpcSet) {
        const [defaultVpc] = res.VpcSet.filter((item: VpcItem) => {
          return item.IsDefault;
        });
        return defaultVpc || null;
      }
      return null;
    } catch (e) {
      console.log(e);
      return null;
    }
  },

  /**
   * get default vpc
   * @param {object} capi capi instance
   * @param {string} vpcId
   */
  async getSubnetList(capi: Capi, vpcId: string) {
    try {
      const res = await APIS.DescribeSubnets(capi, {
        Offset: 0,
        Limit: 100,
        Filters: [
          {
            Name: 'vpc-id',
            Values: [vpcId],
          },
        ],
      });
      if (res.SubnetSet) {
        return res.SubnetSet || null;
      }
      return null;
    } catch (e) {
      console.log(e);
      return null;
    }
  },
  /**
   * get default subnet
   * @param {object} capi capi instance
   * @param {string} vpcId
   */
  async getDefaultSubnet(capi: Capi, vpcId: string): Promise<SubnetItem | null> {
    const subnetList = await this.getSubnetList(capi, vpcId);
    const [defaultSubnet] = (subnetList || []).filter((item: SubnetItem) => {
      return item.IsDefault;
    });

    return defaultSubnet || null;
  },

  /**
   * create default vpc
   * @param capi capi instance
   * @param zone zone
   * @returns
   */
  async createDefaultVpc(capi: Capi, zone?: string): Promise<DefaultVpcItem> {
    // clean undefined
    const params: { Zone?: string } = {};
    if (zone) {
      params.Zone = zone;
    }
    const { Vpc } = await APIS.CreateDefaultVpc(capi, params);
    return Vpc;
  },

  async isDhcpEnable(capi: Capi, vpcId: string): Promise<boolean> {
    const res = await this.getVpcDetail(capi, vpcId);
    if (res) {
      return res.EnableDhcp;
    }
    return false;
  },
};

export default utils;
