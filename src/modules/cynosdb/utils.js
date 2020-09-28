const { sleep, waitResponse } = require('@ygkit/request');
const {
  CreateClusters,
  DescribeClusterDetail,
  IsolateCluster,
  ResetAccountPassword,
} = require('./apis');
const { ApiError } = require('../../utils/error');

// timeout 5 minutes
const TIMEOUT = 5 * 60 * 1000;
const SUPPORT_ZONES = ['ap-beijing-3', 'ap-guangzhou-4', 'ap-nanjing-1', 'ap-shanghai-2'];
const PWD_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@#$%^&*_-';

/**
 *
 * @param {object} capi capi instance
 * @param {*} dBInstanceName
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
    return undefined;
  } catch (e) {
    return undefined;
  }
}

function isSupportZone(zone) {
  return SUPPORT_ZONES.indexOf(zone) !== -1;
}

/**
 * create db cluster
 * @param {object} capi capi client
 * @param {object} dbInputs create db cluster inputs
 */
async function createCluster(capi, dbInputs) {
  if (!isSupportZone(dbInputs.Zone)) {
    throw ApiError({
      type: 'PARAMETER_CYNOSDB',
      message: `Unsupported zone, support zones: ${SUPPORT_ZONES.join(',')}`,
    });
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
 * delete db cluster
 * @param {object} capi capi client
 * @param {string} db cluster name
 */
async function deleteCluster(capi, clusterId) {
  console.log(`Start removing CynosDB cluster id:${clusterId}`);
  await IsolateCluster(capi, {
    ClusterId: clusterId,
  });
  const detail = await waitResponse({
    callback: async () => getClusterDetail(capi, clusterId),
    targetResponse: undefined,
    timeout: TIMEOUT,
  });
  console.log(`Removed CynosDB cluster id: ${clusterId}.`);
  return detail;
}

async function resetPwd(capi, inputs) {
  console.log(
    `Start reset password for CynosDB cluster id:${inputs.clusterId}, account: ${inputs.adminName}`,
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

function formatConnectOutput(detail) {
  const RoAddr = detail.RoAddr || [];
  const readList = RoAddr.map((item) => {
    return {
      ip: item.IP,
      port: item.Port,
    };
  });
  const info = {
    ip: detail.Vip,
    port: detail.Vport,
    readList: readList,
  };

  return info;
}

function generatePwd(length) {
  length = length || 8;
  return Array(length)
    .fill(PWD_CHARS)
    .map((item) => {
      return item[Math.floor(Math.random() * item.length)];
    })
    .join('');
}

module.exports = {
  TIMEOUT,
  PWD_CHARS,
  createCluster,
  getClusterDetail,
  deleteCluster,
  sleep,
  generatePwd,
  formatConnectOutput,
  resetPwd,
};
