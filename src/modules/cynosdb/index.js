const { Capi } = require('@tencent-sdk/capi');
const {
  createCluster,
  getClusterDetail,
  isolateCluster,
  generatePwd,
  formatConnectOutput,
  resetPwd,
  openPublicAccess,
  closePublicAccess,
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
      payMode = 0,
      timeSpan = 1,
      timeUnit = 'm',
      autoVoucher = 1,
      dbMode = 'NORMAL',
      minCpu = 0.5,
      maxCpu = 2,
      autoPause = 'yes',
      autoPauseDelay = 3600, // default 1h
      enablePublicAccess,
    } = inputs;

    const outputs = {
      dbMode,
      region: region,
      zone: zone,
      vpcConfig: vpcConfig,
      instanceCount,
      dbMode,
    };

    if (dbMode === 'SERVERLESS') {
      outputs.minCpu = minCpu;
      outputs.maxCpu = maxCpu;
      outputs.instanceCount = 1;
    }

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
        PayMode: payMode,
        AutoVoucher: autoVoucher,
        RollbackStrategy: 'noneRollback',
        OrderSource: 'serverless',
        VpcId: vpcConfig.vpcId,
        SubnetId: vpcConfig.subnetId,
        AdminPassword: adminPassword,
        VpcId: vpcConfig.vpcId,
        SubnetId: vpcConfig.subnetId,
        AdminPassword: adminPassword || generatePwd(),
        DbMode: dbMode,
      };
      // prepay need set timespan 1month
      if (payMode === 1) {
        dbInputs.TimeSpan = timeSpan;
        dbInputs.TimeUnit = timeUnit;
      }

      if (dbMode === 'SERVERLESS') {
        dbInputs.MinCpu = minCpu;
        dbInputs.MaxCpu = maxCpu;
        dbInputs.AutoPause = autoPause;
        dbInputs.AutoPauseDelay = autoPauseDelay;
      }

      clusterDetail = await createCluster(this.capi, dbInputs);
      outputs.clusterId = clusterDetail.ClusterId;

      outputs.adminPassword = dbInputs.AdminPassword;
    } else {
      console.log(`Cynosdb cluster ${outputs.clusterId} already exist`);
    }

    outputs.connection = formatConnectOutput(clusterDetail);

    if (enablePublicAccess) {
      const wanInfo = await openPublicAccess(this.capi, outputs.clusterId);
      outputs.publicConnection = {
        domain: wanInfo.WanDomain,
        ip: wanInfo.WanIP,
        port: wanInfo.WanPort,
      };
    } else if (enablePublicAccess === false) {
      await closePublicAccess(this.capi, outputs.clusterId);
    }

    return outputs;
  }

  async remove(inputs = {}) {
    const { clusterId } = inputs;

    const clusterDetail = await getClusterDetail(this.capi, clusterId);
    if (clusterDetail && clusterDetail.ClusterId) {
      // need circle for deleting, after host status is 6, then we can delete it
      await isolateCluster(this.capi, clusterId);
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
