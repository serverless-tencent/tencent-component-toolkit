import { Capi } from '@tencent-sdk/capi';
import { waitResponse } from '@ygkit/request';
import APIS from './apis';
import { PostgresqlInstanceDetail, PostgresqlInstanceNetInfo } from './interface';

// timeout 5 minutes
const TIMEOUT = 5 * 60 * 1000;

/**
 *
 * @param {object} capi capi instance
 * @param {*} dBInstanceName
 */
export async function getDbInstanceDetail(
  capi: Capi,
  dBInstanceId: string,
): Promise<PostgresqlInstanceDetail | undefined> {
  // get instance detail
  try {
    const res = await APIS.DescribeServerlessDBInstances(capi, {
      Filter: [
        {
          Name: 'db-instance-id',
          Values: [dBInstanceId],
        },
      ],
    });
    if (res.DBInstanceSet) {
      const {
        DBInstanceSet: [dbDetail],
      } = res;
      return dbDetail;
    }
  } catch (e) {
    console.log(e);
  }
  return undefined;
}

/**
 * get db public access status
 * @param {array} netInfos network infos
 */
export function getDbExtranetAccess(netInfos: { NetType: string; Status: string }[]) {
  let result = false;
  netInfos.forEach((item) => {
    if (item.NetType === 'public') {
      result = item.Status === 'opened';
    }
  });
  return result;
}

export function isEnablePublicAccess(detail: PostgresqlInstanceDetail) {
  let enable = false;
  const { DBInstanceNetInfo } = detail;
  DBInstanceNetInfo.forEach((item: PostgresqlInstanceNetInfo) => {
    if (item.NetType === 'public' && item.Status === 'opened') {
      enable = true;
    }
  });
  return enable;
}

/**
 INSTANCE_STATUS_APPLYING:    "applying",    申请中
 INSTANCE_STATUS_INIT:        "init",        待初始化
 INSTANCE_STATUS_INITING:     "initing",     初始化中
 INSTANCE_STATUS_OK:          "running",     运行中
 INSTANCE_STATUS_LIMITED:     "limited run", 受限运行
 INSTANCE_STATUS_ISOLATED:    "isolated",    已隔离
 INSTANCE_STATUS_RECYCLING:   "recycling",   回收中
 INSTANCE_STATUS_RECYCLED:    "recycled",    已回收
 INSTANCE_STATUS_JOB_RUNNING: "job running", 任务执行中
 INSTANCE_STATUS_OFFLINE:     "offline",     下线
 INSTANCE_STATUS_MIGRATE:     "migrating",   迁移中
 INSTANCE_STATUS_EXPANDING:   "expanding",   扩容中
 INSTANCE_STATUS_READONLY:    "readonly",    只读
 INSTANCE_STATUS_RESTARTING:  "restarting",  重启中
 */

/**
 * toggle db instance extranet access
 * @param {object} capi capi client
 * @param {string} dBInstanceName db instance name
 * @param {boolean} extranetAccess whether open extranet accesss
 */
export async function toggleDbInstanceAccess(
  capi: Capi,
  DBInstanceId: string,
  extranetAccess: boolean,
): Promise<PostgresqlInstanceDetail> {
  if (extranetAccess) {
    console.log(`Start open db extranet access...`);
    await APIS.OpenServerlessDBExtranetAccess(capi, {
      DBInstanceId: DBInstanceId,
    });
    const detail = await waitResponse({
      callback: async () => getDbInstanceDetail(capi, DBInstanceId),
      targetResponse: 'running',
      targetProp: 'DBInstanceStatus',
      timeout: TIMEOUT,
    });
    console.log(`Open db extranet access success`);
    return detail;
  }
  console.log(`Start close db extranet access`);
  await APIS.CloseServerlessDBExtranetAccess(capi, {
    DBInstanceId: DBInstanceId,
  });
  const detail = await waitResponse({
    callback: async () => getDbInstanceDetail(capi, DBInstanceId),
    targetResponse: 'running',
    targetProp: 'DBInstanceStatus',
    timeout: TIMEOUT,
  });
  console.log(`Close db extranet access success`);
  return detail;
}

/**
 * create db instance
 * @param {object} capi capi client
 * @param {object} postgresInputs create db instance inputs
 */
export async function createDbInstance(
  capi: Capi,
  postgresInputs: {
    Zone: string;
    ProjectId: number;
    DBInstanceName: string;
    DBVersion: string;
    DBCharset: string;
    VpcId: string;
    SubnetId: string;
  },
) {
  console.log(`Start create DB instance ${postgresInputs.DBInstanceName}`);
  const { DBInstanceId } = await APIS.CreateServerlessDBInstance(capi, postgresInputs);
  console.log(`Creating db instance id: ${DBInstanceId}`);

  const detail = await waitResponse({
    callback: async () => getDbInstanceDetail(capi, DBInstanceId),
    targetResponse: 'running',
    targetProp: 'DBInstanceStatus',
    timeout: TIMEOUT,
  });
  console.log(`Created db instance id ${DBInstanceId} success`);
  return detail;
}

/**
 * delete db instance
 * @param {object} capi capi client
 * @param {string} db instance name
 */
export async function deleteDbInstance(capi: Capi, DBInstanceId: string) {
  console.log(`Start removing postgres instance id ${DBInstanceId}`);
  await APIS.DeleteServerlessDBInstance(capi, {
    DBInstanceId,
  });
  const detail = await waitResponse({
    callback: async () => getDbInstanceDetail(capi, DBInstanceId),
    targetResponse: undefined,
    timeout: TIMEOUT,
  });
  console.log(`Removed postgres instance id ${DBInstanceId} successfully`);
  return detail;
}

/**
 * format postgresql connect string
 * @param {object} netInfo network info
 * @param {object} accountInfo account info
 * @param {string} dbName db name
 */
export function formatPgUrl(
  netInfo: { Address?: string; Ip?: string; Port: string },
  accountInfo: { DBPassword: string; DBUser: string },
  dbName: string,
) {
  return {
    connectionString: `postgresql://${accountInfo.DBUser}:${encodeURIComponent(
      accountInfo.DBPassword,
    )}@${netInfo.Address || netInfo.Ip}:${netInfo.Port}/${dbName}`,
    host: netInfo.Address || netInfo.Ip,
    port: netInfo.Port,
    user: accountInfo.DBUser,
    password: accountInfo.DBPassword,
    dbname: dbName,
  };
}
