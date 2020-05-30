const { Capi } = require('@tencent-sdk/capi');
const {
  createDbInstance,
  getDbInstanceDetail,
  getDbExtranetAccess,
  toggleDbInstanceAccess,
  deleteDbInstance,
  formatPgUrl,
} = require('./utils');

class Postgresql {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.capi = new Capi({
      Region: region,
      AppId: this.credentials.AppId,
      SecretId: this.credentials.SecretId,
      SecretKey: this.credentials.SecretKey,
      Token: this.credentials.Token,
    });
  }

  async deploy(inputs = {}) {
    const {
      region,
      zone,
      projectId,
      dBInstanceName,
      dBVersion,
      dBCharset,
      extranetAccess,
      vpcConfig,
    } = inputs;

    const outputs = {
      region: region,
      zone: zone,
      vpcConfig: vpcConfig,
      dBInstanceName: dBInstanceName,
    };

    let dbDetail = await getDbInstanceDetail(this.capi, dBInstanceName);

    if (dbDetail && dbDetail.DBInstanceName && dbDetail.Zone === zone) {
      const publicAccess = getDbExtranetAccess(dbDetail.DBInstanceNetInfo);
      // exist and public access config different, update db instance
      if (publicAccess !== extranetAccess) {
        console.log(`DB instance ${dBInstanceName} existed, updating...`);
        dbDetail = await toggleDbInstanceAccess(this.capi, dBInstanceName, extranetAccess);
      } else {
        console.log(`DB instance ${dBInstanceName} existed.`);
      }
    } else {
      // not exist, create
      const postgresInputs = {
        Zone: zone,
        ProjectId: projectId,
        DBInstanceName: dBInstanceName,
        DBVersion: dBVersion,
        DBCharset: dBCharset,
      };

      if (vpcConfig.vpcId) {
        postgresInputs.VpcId = vpcConfig.vpcId;
      }

      if (vpcConfig.subnetId) {
        postgresInputs.SubnetId = vpcConfig.subnetId;
      }
      dbDetail = await createDbInstance(this.capi, postgresInputs);
      outputs.dBInstanceId = dbDetail.DBInstanceId;
      if (extranetAccess) {
        dbDetail = await toggleDbInstanceAccess(this.capi, dBInstanceName, extranetAccess);
      }
    }

    const {
      DBInstanceNetInfo,
      DBAccountSet: [accountInfo],
      DBDatabaseList: [dbName],
    } = dbDetail;
    let internetInfo = null;
    let extranetInfo = null;

    DBInstanceNetInfo.forEach((item) => {
      if (item.NetType === 'private') {
        internetInfo = item;
      }
      if (item.NetType === 'public') {
        extranetInfo = item;
      }
    });
    if (vpcConfig.vpcId) {
      outputs.private = formatPgUrl(internetInfo, accountInfo, dbName);
    }
    if (extranetAccess && extranetInfo) {
      outputs.public = formatPgUrl(extranetInfo, accountInfo, dbName);
    }

    return outputs;
  }

  async remove(inputs = {}) {
    const { dBInstanceName } = inputs;

    const dbDetail = await getDbInstanceDetail(this.capi, dBInstanceName);
    if (dbDetail && dbDetail.DBInstanceName) {
      // need circle for deleting, after host status is 6, then we can delete it
      await deleteDbInstance(this.capi, dBInstanceName);
    }
    return {};
  }
}

module.exports = Postgresql;
