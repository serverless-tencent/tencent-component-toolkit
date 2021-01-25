import { CynosdbResetPwdInputs } from './interface';
import { Capi } from '@tencent-sdk/capi';
import { waitResponse } from '@ygkit/request';
import APIS from './apis';
import { ApiError } from '../../utils/error';

export { sleep, waitResponse } from '@ygkit/request';

// timeout 5 minutes
export const TIMEOUT = 5 * 60 * 1000;
export const SUPPORT_ZONES = ['ap-beijing-3', 'ap-guangzhou-4', 'ap-nanjing-1', 'ap-shanghai-2'];
export const PWD_CHARS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@#$%^&*_-';

export function generatePwd(length = 8) {
  const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
  const NUMBER = '0123456789';
  const SPECIAL = '~!@#$%^&*_-';

  let password = '';
  let character = '';
  while (password.length < length) {
    const entity1 = Math.ceil(ALPHABET.length * Math.random() * Math.random());
    const entity2 = Math.ceil(SPECIAL.length * Math.random() * Math.random());
    const entity3 = Math.ceil(NUMBER.length * Math.random() * Math.random());

    let hold = ALPHABET.charAt(entity1);
    hold = password.length % 2 === 0 ? hold.toUpperCase() : hold;
    character += hold;
    character += SPECIAL.charAt(entity2);
    character += NUMBER.charAt(entity3);
    password = character;
  }
  password = password
    .split('')
    .sort(function () {
      return 0.5 - Math.random();
    })
    .join('');

  return password.substr(0, length);
}

export function isValidPwd(password: string) {
  const minLen = 8;
  const maxLen = 64;
  const pwdLen = password.length;
  if (pwdLen < minLen || pwdLen > maxLen) {
    return false;
  }

  const numStr = '0123456789';
  const lowerCaseLetter = 'abcdefghijklmnopqrstuvwxyz';
  const upperCaseLetter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const specStr = "~!@#$%^&*_-+=`|\\(){}[]:;'<>,.?/";

  let numFlag = 0;
  let lowerCaseFlag = 0;
  let upperCaseFlag = 0;
  let specFlag = 0;

  for (let i = 0; i < pwdLen; i++) {
    const curChar = password[i];
    if (numStr.indexOf(curChar) !== -1) {
      numFlag = 1;
    } else if (lowerCaseLetter.indexOf(curChar) !== -1) {
      lowerCaseFlag = 1;
    } else if (upperCaseLetter.indexOf(curChar) !== -1) {
      upperCaseFlag = 1;
    } else if (specStr.indexOf(curChar) !== -1) {
      specFlag = 1;
    } else {
      return false;
    }
  }

  if (numFlag + lowerCaseFlag + upperCaseFlag + specFlag < 3) {
    return false;
  }

  return true;
}

// FIXME: isServerless is unused
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function isSupportZone(zone: string, isServerless = false) {
  if (SUPPORT_ZONES.indexOf(zone) === -1) {
    throw new ApiError({
      type: 'PARAMETER_CYNOSDB',
      message: `Unsupported zone, support zones: ${SUPPORT_ZONES.join(',')}`,
    });
  }
  return true;
}

export function formatConnectOutput(detail: {
  Vip: string;
  Vport: string;
  DbMode: string;
  RoAddr: { IP: string; Port: string }[];
}) {
  const info: {
    ip: string;
    port: string;
    readList?: { ip: string; port: string }[];
  } = {
    ip: detail.Vip,
    port: detail.Vport,
  };
  if (detail.DbMode !== 'SERVERLESS') {
    const RoAddr = detail.RoAddr || [];
    info.readList = RoAddr.map((item) => {
      return {
        ip: item.IP,
        port: item.Port,
      };
    });
  }

  return info;
}

/**
 * get custer detail
 * @param {object} capi capi client
 * @param {string} clusterId cluster id
 */
export async function getClusterDetail(capi: Capi, clusterId: string) {
  // get instance detail
  try {
    const res = await APIS.DescribeClusterDetail(capi, {
      ClusterId: clusterId,
    });
    if (res.Detail) {
      return res.Detail;
    }
  } catch (e) {
    // no op
  }
  return undefined;
}

/**
 * get instance detail
 * @param {object} capi capi instance
 * @param {*} dBInstanceName
 */
export async function getInstanceDetail(capi: Capi, instanceId: string) {
  // get instance detail
  try {
    const res = await APIS.DescribeInstanceDetail(capi, {
      InstanceId: instanceId,
    });
    if (res.Detail) {
      return res.Detail;
    }
  } catch (e) {
    // no op
  }
  return undefined;
}

/**
 * get db cluster instances
 * @param {object} capi capi client
 * @param {string} clusterId cluster id
 */
export async function getClusterInstances(
  capi: Capi,
  clusterId: string,
): Promise<
  | {
      InstanceId: string;
      InstanceName: string;
      InstanceRole: string;
      Status: string;
      InstanceType: string;
    }[]
  | undefined
> {
  const res = await APIS.DescribeInstances(capi, {
    Filters: [{ Names: ['ClusterId'], Values: [clusterId], ExactMatch: true }],
  });
  if (res && res.InstanceSet) {
    return res.InstanceSet;
  }
}

/**
 * get serverless specs
 * @param {object} capi capi client
 * @param {object} options
 */
export async function getServerlessSpecs(
  capi: Capi,
  { minCpu, maxCpu }: { minCpu?: number; maxCpu?: number } = {},
) {
  const { Specs } = (await APIS.DescribeServerlessInstanceSpecs(capi, {})) as {
    Specs: {
      MinCpu: number;
      MaxCpu: number;
      MaxStorageSize: number;
    }[];
  };
  const [curSpec] = Specs.filter((item) => item.MinCpu === minCpu && item.MaxCpu === maxCpu);
  if (!curSpec) {
    throw new ApiError({
      type: 'PARAMETER_CYNOSDB',
      message: `Unsupported cpu configs minCpu: ${minCpu}, maxCpu: ${maxCpu}`,
    });
  }

  return curSpec;
}

/**
 * create db cluster
 * @param {object} capi capi client
 * @param {object} dbInputs create db cluster inputs
 */
export async function createCluster(
  capi: Capi,
  dbInputs: { DbMode: string; Zone: string; MinCpu: number; MaxCpu: number; StorageLimit: number },
) {
  const isServerless = dbInputs.DbMode === 'SERVERLESS';
  isSupportZone(dbInputs.Zone);

  if (isServerless) {
    const curSpec = await getServerlessSpecs(capi, {
      minCpu: dbInputs.MinCpu,
      maxCpu: dbInputs.MaxCpu,
    });

    dbInputs.StorageLimit = curSpec.MaxStorageSize;
  }

  console.log(`Start create CynosDB cluster`);
  const res = await APIS.CreateClusters(capi, dbInputs);

  const clusterId = res.ClusterIds[0];
  console.log(`Creating CynosDB cluster id: ${clusterId}`);

  const detail = await waitResponse({
    callback: async () => getClusterDetail(capi, clusterId),
    targetResponse: 'running',
    targetProp: 'Status',
    loopGap: 2000,
    timeout: TIMEOUT,
  });
  console.log(`Created CynosDB cluster id ${clusterId} successfully`);
  return detail;
}

/**
 * isolate db cluster
 * @param {object} capi capi client
 * @param {string} clusterId cluster id
 */
export async function isolateCluster(capi: Capi, clusterId: string) {
  console.log(`Start isolating CynosDB cluster id: ${clusterId}`);
  await APIS.IsolateCluster(capi, {
    ClusterId: clusterId,
  });
  const detail = await waitResponse({
    callback: async () => getClusterDetail(capi, clusterId),
    targetProp: 'Status',
    targetResponse: 'isolated',
    timeout: TIMEOUT,
  });
  console.log(`Isolated CynosDB cluster id: ${clusterId}.`);
  return detail;
}

/**
 * offline db cluster instance
 * @param {*} capi capi client
 * @param {*} clusterId cluster id
 * @param {*} instanceId instance id
 */
export async function offlineInstance(capi: Capi, clusterId: string, instanceId: string) {
  console.log(`Start offlining CynosDB instance id: ${instanceId}`);
  await APIS.OfflineCluster(capi, {
    ClusterId: clusterId,
    InstanceIdList: [instanceId],
  });
  const detail = await waitResponse({
    callback: async () => getInstanceDetail(capi, clusterId),
    targetResponse: undefined,
    timeout: TIMEOUT,
  });
  console.log(`Offlined CynosDB instance id: ${instanceId}`);
  return detail;
}

/**
 * offline db cluster
 * @param {object} capi capi client
 * @param {string} clusterId cluster id
 */
export async function offlineCluster(capi: Capi, clusterId: string) {
  // 1. get cluster instances
  const instances = await getClusterInstances(capi, clusterId);
  const instanceIds = (instances || []).map((item: { InstanceId: string }) => item.InstanceId);
  console.log(`Start offlining CynosDB id: ${clusterId}`);

  await APIS.OfflineInstance(capi, {
    ClusterId: clusterId,
    InstanceIdList: instanceIds,
  });

  const detail = await waitResponse({
    callback: async () => getClusterDetail(capi, clusterId),
    targetResponse: undefined,
    timeout: TIMEOUT,
  });
  console.log(`Offlined CynosDB id: ${clusterId}`);
  return detail;
}

export async function resetPwd(capi: Capi, inputs: CynosdbResetPwdInputs) {
  console.log(
    `Start reset password for CynosDB cluster id: ${inputs.clusterId}, account: ${inputs.adminName}`,
  );
  await APIS.ResetAccountPassword(capi, {
    ClusterId: inputs.clusterId,
    AccountName: inputs.adminName || 'root',
    AccountPassword: inputs.adminPassword,
    Host: inputs.host || '%',
  });
  console.log(
    `Reset password for CynosDB cluster id: ${inputs.clusterId}, account: ${inputs.adminName} success.`,
  );
  return true;
}

export async function getClusterGrpsInfo(capi: Capi, clusterId: string) {
  const { InstanceGrpInfoList = [] } = await APIS.DescribeClusterInstanceGrps(capi, {
    ClusterId: clusterId,
  });
  return InstanceGrpInfoList[0];
}

export async function openPublicAccess(capi: Capi, clusterId: string) {
  const gprInfo = await getClusterGrpsInfo(capi, clusterId);
  if (gprInfo.WanStatus === 'open') {
    return gprInfo;
  }

  console.log(`Start opening public access to cluster ${clusterId}`);
  await APIS.OpenWan(capi, {
    InstanceGrpId: gprInfo.InstanceGrpId,
  });

  const res = await waitResponse({
    callback: async () => getClusterGrpsInfo(capi, clusterId),
    targetProp: 'WanStatus',
    targetResponse: 'open',
    timeout: TIMEOUT,
  });
  console.log(`Open public access to cluster ${clusterId} success`);
  return res;
}

export async function closePublicAccess(capi: Capi, clusterId: string) {
  const gprInfo = await getClusterGrpsInfo(capi, clusterId);
  if (gprInfo.WanStatus !== 'open') {
    return gprInfo;
  }
  console.log(`Start closing public access to cluster ${clusterId}`);
  await APIS.CloseWan(capi, {
    InstanceGrpId: gprInfo.InstanceGrpId,
  });

  const res = await waitResponse({
    callback: async () => getClusterGrpsInfo(capi, clusterId),
    targetProp: 'WanStatus',
    targetResponse: 'closed',
    timeout: TIMEOUT,
  });
  console.log(`Close public access to cluster ${clusterId} success`);
  return res;
}
