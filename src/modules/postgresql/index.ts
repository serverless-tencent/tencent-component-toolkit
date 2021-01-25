import { RegionType, CapiCredentials, ApiServiceType } from './../interface';

import { Capi } from '@tencent-sdk/capi';
import {
  PostgresqlDeployInputs,
  PostgresqlDeployOutputs,
  PostgresqlRemoveInputs,
} from './interface';
import {
  createDbInstance,
  getDbInstanceDetail,
  getDbExtranetAccess,
  toggleDbInstanceAccess,
  deleteDbInstance,
  formatPgUrl,
} from './utils';

export default class Postgresql {
  capi: Capi;
  region: RegionType;
  credentials: CapiCredentials;

  constructor(credentials: CapiCredentials = {}, region: RegionType) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.postgres,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });
  }

  /** 部署 postgresql 实例 */
  async deploy(inputs: PostgresqlDeployInputs = {}) {
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

    const outputs: PostgresqlDeployOutputs = {
      region: region,
      zone: zone,
      vpcConfig: vpcConfig,
      dBInstanceName: dBInstanceName,
    };

    let dbDetail = await getDbInstanceDetail(this.capi, dBInstanceName!);

    if (dbDetail && dbDetail.DBInstanceName && dbDetail.Zone === zone) {
      const publicAccess = getDbExtranetAccess(dbDetail.DBInstanceNetInfo);
      // exist and public access config different, update db instance
      if (publicAccess !== extranetAccess) {
        console.log(`DB instance ${dBInstanceName} existed, updating`);
        // do not throw error when open public access
        try {
          dbDetail = await toggleDbInstanceAccess(this.capi, dBInstanceName!, extranetAccess!);
        } catch (e) {
          console.log(`Toggle DB Instane access failed, ${e.message}, ${e.reqId}`);
        }
      } else {
        console.log(`DB instance ${dBInstanceName} existed.`);
      }
    } else {
      // not exist, create
      const postgresInputs = {
        Zone: zone!,
        ProjectId: projectId!,
        DBInstanceName: dBInstanceName!,
        DBVersion: dBVersion!,
        DBCharset: dBCharset!,
        VpcId: vpcConfig?.vpcId!,
        SubnetId: vpcConfig?.subnetId!,
      };

      dbDetail = await createDbInstance(this.capi, postgresInputs);
      if (extranetAccess) {
        dbDetail = await toggleDbInstanceAccess(this.capi, dBInstanceName!, extranetAccess);
      }
    }
    outputs.dBInstanceId = dbDetail.DBInstanceId;

    const {
      DBInstanceNetInfo,
      DBAccountSet: [accountInfo],
      DBDatabaseList: [dbName],
    } = dbDetail;
    let internetInfo: { Address?: string; Ip?: string; Port: string };
    let extranetInfo: { Address?: string; Ip?: string; Port: string };

    DBInstanceNetInfo.forEach(
      (item: { Address?: string; Ip?: string; Port: string; NetType: 'private' | 'public' }) => {
        if (item.NetType === 'private') {
          internetInfo = item;
        }
        if (item.NetType === 'public') {
          extranetInfo = item;
        }
      },
    );
    if (vpcConfig?.vpcId) {
      outputs.private = formatPgUrl(internetInfo!, accountInfo, dbName);
    }
    if (extranetAccess && extranetInfo!) {
      outputs.public = formatPgUrl(extranetInfo, accountInfo, dbName);
    }

    return outputs;
  }

  /** 移除 postgresql 实例 */
  async remove(inputs: PostgresqlRemoveInputs = {}) {
    const { dBInstanceName } = inputs;

    const dbDetail = await getDbInstanceDetail(this.capi, dBInstanceName!);
    if (dbDetail && dbDetail.DBInstanceName) {
      // need circle for deleting, after host status is 6, then we can delete it
      await deleteDbInstance(this.capi, dBInstanceName!);
    }
    return {};
  }
}
