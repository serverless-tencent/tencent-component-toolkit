const {
  DescribeVpcs,
  DescribeSubnets,
  CreateVpc,
  DeleteVpc,
  CreateSubnet,
  DeleteSubnet,
  ModifyVpcAttribute,
  ModifySubnetAttribute,
} = require('./apis');

const utils = {
  /**
   *
   * @param {object} capi capi instance
   * @param {string} vpcId
   */
  async getVpcDetail(capi, vpcId) {
    // get instance detail
    try {
      const res = await DescribeVpcs(capi, {
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
  async getSubnetDetail(capi, subnetId) {
    try {
      const res = await DescribeSubnets(capi, {
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

  async createVpc(capi, inputs) {
    const res = await CreateVpc(capi, inputs);
    if (res.Vpc && res.Vpc.VpcId) {
      const { Vpc } = res;
      return Vpc;
    }
  },

  async modifyVpc(capi, inputs) {
    await ModifyVpcAttribute(capi, inputs);
  },

  async deleteVpc(capi, vpcId) {
    await DeleteVpc(capi, {
      VpcId: vpcId,
    });
  },

  async createSubnet(capi, inputs) {
    const res = await CreateSubnet(capi, inputs);
    if (res.Subnet && res.Subnet.SubnetId) {
      const { Subnet } = res;
      return Subnet;
    }
  },

  async modifySubnet(capi, inputs) {
    await ModifySubnetAttribute(capi, inputs);
  },

  async deleteSubnet(capi, subnetId) {
    await DeleteSubnet(capi, {
      SubnetId: subnetId,
    });
  },
};

module.exports = utils;
