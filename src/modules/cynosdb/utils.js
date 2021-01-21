const { sleep, waitResponse } = require('@ygkit/request');
const {
  CreateClusters,
  DescribeClusterDetail,
  DescribeInstanceDetail,
  IsolateCluster,
  ResetAccountPassword,
  DescribeServerlessInstanceSpecs,
  // OfflineCluster,
  OfflineInstance,
  DescribeInstances,
  OpenWan,
  CloseWan,
  DescribeClusterInstanceGrps,
} = require('./apis');
const { ApiError } = require('../../utils/error');

// timeout 5 minutes
const TIMEOUT = 5 * 60 * 1000;
const SUPPORT_ZONES = ['ap-beijing-3', 'ap-guangzhou-4', 'ap-shanghai-2', 'ap-nanjing-1'];

function generatePwd(length = 8) {
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
    .sort(function() {
      return 0.5 - Math.random();
    })
    .join('');

  return password.substr(0, length);
}

function isValidPwd(password) {
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

function isSupportZone(zone) {
  if (SUPPORT_ZONES.indexOf(zone) === -1) {
    throw ApiError({
      type: 'PARAMETER_CYNOSDB',
      message: `Unsupported zone, support zones: ${SUPPORT_ZONES.join(',')}`,
    });
  }
  return true;
}

function formatConnectOutput(detail) {
  const info = {
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
async function getClusterDetail(capi, clusterId) {
  // get instance detail
  try {
    const res = await DescribeClusterDetail(capi, {
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
async function getInstanceDetail(capi, instanceId) {
  // get instance detail
  try {
    const res = await DescribeInstanceDetail(capi, {
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
async function getClusterInstances(capi, clusterId) {
  const res = await DescribeInstances(capi, {
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
async function getServerlessSpecs(capi, { minCpu, maxCpu } = {}) {
  const { Specs } = await DescribeServerlessInstanceSpecs(capi, {});
  const [curSpec] = Specs.filter((item) => item.MinCpu === minCpu && item.MaxCpu === maxCpu);
  if (!curSpec) {
    throw ApiError({
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
async function createCluster(capi, dbInputs) {
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
  const res = await CreateClusters(capi, dbInputs);

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
async function isolateCluster(capi, clusterId) {
  console.log(`Start isolating CynosDB cluster id: ${clusterId}`);
  await IsolateCluster(capi, {
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
async function offlineCluster(capi, clusterId) {
  // 1. get cluster instances
  const instances = await getClusterInstances(capi, clusterId);
  const instanceIds = instances.map((item) => item.InstanceId);
  console.log(`Start offlining CynosDB id: ${clusterId}`);

  await OfflineInstance(capi, {
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

// /**
//  * offline db cluster
//  * @param {object} capi capi client
//  * @param {string} clusterId cluster id
//  */
// async function offlineCluster(capi, clusterId) {
//   console.log(`Start offlining CynosDB cluster id: ${clusterId}`);
//   await OfflineCluster(capi, {
//     ClusterId: clusterId,
//   });
//   const detail = await waitResponse({
//     callback: async () => getClusterDetail(capi, clusterId),
//     targetResponse: undefined,
//     timeout: TIMEOUT,
//   });
//   console.log(`Offlined CynosDB cluster id: ${clusterId}.`);
//   return detail;
// }

async function resetPwd(capi, inputs) {
  console.log(
    `Start reset password for CynosDB cluster id: ${inputs.clusterId}, account: ${inputs.adminName}`,
  );
  await ResetAccountPassword(capi, {
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

async function getClusterGrpsInfo(capi, clusterId) {
  const { InstanceGrpInfoList = [] } = await DescribeClusterInstanceGrps(capi, {
    ClusterId: clusterId,
  });
  return InstanceGrpInfoList[0];
}

async function openPublicAccess(capi, clusterId) {
  const gprInfo = await getClusterGrpsInfo(capi, clusterId);
  if (gprInfo.WanStatus === 'open') {
    return gprInfo;
  }

  console.log(`Start opening public access to cluster ${clusterId}`);
  await OpenWan(capi, {
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

async function closePublicAccess(capi, clusterId) {
  const gprInfo = await getClusterGrpsInfo(capi, clusterId);
  if (gprInfo.WanStatus !== 'open') {
    return gprInfo;
  }
  console.log(`Start closing public access to cluster ${clusterId}`);
  await CloseWan(capi, {
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

module.exports = {
  TIMEOUT,
  sleep,
  generatePwd,
  isValidPwd,
  formatConnectOutput,
  resetPwd,
  createCluster,
  getClusterDetail,
  getClusterInstances,
  isolateCluster,
  offlineCluster,
  getInstanceDetail,
  openPublicAccess,
  closePublicAccess,
};
