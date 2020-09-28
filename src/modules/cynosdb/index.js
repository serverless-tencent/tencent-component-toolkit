const { Capi } = require('@tencent-sdk/capi');
const {
  createCluster,
  getClusterDetail,
  deleteCluster,
  generatePwd,
  formatConnectOutput,
  resetPwd,
} = require('./utils');
const { ApiError } = require('../../utils/error');

class Cynosdb {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      AppId: this.credentials.AppId,
      SecretId: this.credentials.SecretId,
      SecretKey: this.credentials.SecretKey,
      Token: this.credentials.Token,
    });
  }

  async deploy(inputs = {}) {
    const {
      clusterId,
      region,
      zone,
      vpcConfig,
      projectId = 0,
      dbVersion = '5.7',
      dbType = 'MYSQL',
      port = 3306,
      cpu = 1,
      memory = 1,
      storageLimit = 1000,
      instanceCount = 2,
      adminPassword,
    } = inputs;

    const outputs = {
      region: region,
      zone: zone,
      vpcConfig: vpcConfig,
      instanceCount,
    };

    let isExisted = false;
    let clusterDetail = null;
    if (clusterId) {
      clusterDetail = await getClusterDetail(this.capi, clusterId);
      if (clusterDetail && clusterDetail.ClusterId) {
        isExisted = true;
        outputs.clusterId = clusterDetail.ClusterId;
        if (adminPassword) {
          outputs.adminPassword = adminPassword;
        }
      }
    }
    if (!isExisted) {
      // not exist, create
      const dbInputs = {
        Zone: zone,
        ProjectId: projectId,
        DbType: dbType,
        DbVersion: dbVersion,
        Port: port,
        Cpu: cpu,
        Memory: memory,
        StorageLimit: storageLimit,
        InstanceCount: instanceCount,
        PayMode: 0,
        AutoVoucher: 1,
        RollbackStrategy: 'noneRollback',
        OrderSource: 'serverless',
        VpcId: vpcConfig.vpcId,
        SubnetId: vpcConfig.subnetId,
        AdminPassword: adminPassword,
        VpcId: vpcConfig.vpcId,
        SubnetId: vpcConfig.subnetId,
        AdminPassword: adminPassword || generatePwd(),
      };

      clusterDetail = await createCluster(this.capi, dbInputs);
      outputs.clusterId = clusterDetail.ClusterId;

      outputs.adminPassword = dbInputs.AdminPassword;
    }

    outputs.connection = formatConnectOutput(clusterDetail);

    return outputs;
  }

  async remove(inputs = {}) {
    const { clusterId } = inputs;

    const clusterDetail = await getClusterDetail(this.capi, clusterId);
    if (clusterDetail && clusterDetail.ClusterId) {
      // need circle for deleting, after host status is 6, then we can delete it
      await deleteCluster(this.capi, clusterId);
    }
    return true;
  }

  async resetPwd(inputs = {}) {
    const { clusterId } = inputs;

    const clusterDetail = await getClusterDetail(this.capi, clusterId);
    if (clusterDetail && clusterDetail.ClusterId) {
      // need circle for deleting, after host status is 6, then we can delete it
      await resetPwd(this.capi, inputs);
    } else {
      throw ApiError({
        type: 'PARAMETER_CYNOSDB',
        message: `CynosDB cluster id: ${clusterId} not exist.`,
      });
    }
    return true;
  }
}

module.exports = Cynosdb;
