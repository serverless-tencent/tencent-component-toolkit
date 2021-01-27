import { Capi } from '@tencent-sdk/capi';
import { waitResponse } from '@ygkit/request';
import APIS from './apis';

// timeout 5 minutes
const TIMEOUT = 5 * 60 * 1000;

/**
 *
 * @param {object} capi capi instance
 * @param {*} dBInstanceName
 */
export async function getDbInstanceDetail(capi: Capi, dBInstanceName: string) {
  // get instance detail
  try {
    const res = await APIS.DescribeServerlessDBInstances(capi, {
      Filter: [
        {
          Name: 'db-instance-name',
          Values: [dBInstanceName],
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
  dBInstanceName: string,
  extranetAccess: boolean,
) {
  if (extranetAccess) {
    console.log(`Start open db extranet access...`);
    await APIS.OpenServerlessDBExtranetAccess(capi, {
      DBInstanceName: dBInstanceName,
    });
    const detail = await waitResponse({
      callback: async () => getDbInstanceDetail(capi, dBInstanceName),
      targetResponse: 'running',
      targetProp: 'DBInstanceStatus',
      timeout: TIMEOUT,
    });
    console.log(`Open db extranet access success`);
    return detail;
  }
  console.log(`Start close db extranet access`);
  await APIS.CloseServerlessDBExtranetAccess(capi, {
    DBInstanceName: dBInstanceName,
  });
  const detail = await waitResponse({
    callback: async () => getDbInstanceDetail(capi, dBInstanceName),
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
  console.log(`Creating DB instance ID: ${DBInstanceId}`);

  const detail = await waitResponse({
    callback: async () => getDbInstanceDetail(capi, postgresInputs.DBInstanceName),
    targetResponse: 'running',
    targetProp: 'DBInstanceStatus',
    timeout: TIMEOUT,
  });
  console.log(`Created DB instance name ${postgresInputs.DBInstanceName} successfully`);
  return detail;
}

/**
 * delete db instance
 * @param {object} capi capi client
 * @param {string} db instance name
 */
export async function deleteDbInstance(capi: Capi, dBInstanceName: string) {
  console.log(`Start removing postgres instance ${dBInstanceName}`);
  await APIS.DeleteServerlessDBInstance(capi, {
    DBInstanceName: dBInstanceName,
  });
  const detail = await waitResponse({
    callback: async () => getDbInstanceDetail(capi, dBInstanceName),
    targetResponse: undefined,
    timeout: TIMEOUT,
  });
  console.log(`Removed postgres instance ${dBInstanceName} successfully`);
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
