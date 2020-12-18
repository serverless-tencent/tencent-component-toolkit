const { sleep, waitResponse } = require('@ygkit/request');
const {
  CreateClusters,
  DescribeClusterDetail,
  DescribeInstanceDetail,
  IsolateCluster,
  ResetAccountPassword,
  DescribeServerlessInstanceSpecs,
  OfflineCluster,
  DescribeInstances,
  OpenWan,
  CloseWan,
  DescribeClusterInstanceGrps,
} = require('./apis');
const { ApiError } = require('../../utils/error');

// timeout 5 minutes
const TIMEOUT = 5 * 60 * 1000;
const SUPPORT_ZONES = ['ap-beijing-3', 'ap-guangzhou-4', 'ap-nanjing-1', 'ap-shanghai-2'];
const SERVERLESS_SUPPORT_ZONES = ['ap-shanghai-2', 'ap-nanjing-1'];
const PWD_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@#$%^&*_-';

function generatePwd(length) {
  length = length || 8;
  return Array(length)
    .fill(PWD_CHARS)
    .map((item) => {
      return item[Math.floor(Math.random() * item.length)];
    })
    .join('');
}

function isSupportZone(zone, isServerless = false) {
  const supportZones = isServerless ? SERVERLESS_SUPPORT_ZONES : SUPPORT_ZONES;
  if (supportZones.indexOf(zone) === -1) {
    throw ApiError({
      type: 'PARAMETER_CYNOSDB',
      message: `Unsupported zone, support zones: ${supportZones.join(',')}`,
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
  isSupportZone(dbInputs.Zone, isServerless);

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
async function offlineInstance(capi, clusterId, instanceId) {
  console.log(`Start offlining CynosDB instance id: ${instanceId}`);
  await OfflineCluster(capi, {
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
async function offlineCluster(capi, clusterId) {
  console.log(`Start offlining CynosDB cluster id: ${clusterId}`);
  await OfflineCluster(capi, {
    ClusterId: clusterId,
  });
  const detail = await waitResponse({
    callback: async () => getClusterDetail(capi, clusterId),
    targetResponse: undefined,
    timeout: TIMEOUT,
  });
  console.log(`Offlined CynosDB cluster id: ${clusterId}.`);
  return detail;
}

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
  PWD_CHARS,
  sleep,
  generatePwd,
  formatConnectOutput,
  resetPwd,
  createCluster,
  getClusterDetail,
  getClusterInstances,
  isolateCluster,
  offlineCluster,
  offlineInstance,
  getInstanceDetail,
  openPublicAccess,
  closePublicAccess,
};
