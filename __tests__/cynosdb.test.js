const { Cynosdb } = require('../src');
const {
  getClusterDetail,
  sleep,
  generatePwd,
  isValidPwd,
  offlineCluster,
} = require('../src/modules/cynosdb/utils');

describe('Cynosdb', () => {
  jest.setTimeout(600000);
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const region = 'ap-shanghai';
  const client = new Cynosdb(credentials, region);

  const inputs = {
    region,
    zone: 'ap-shanghai-2',
    vpcConfig: {
      vpcId: 'vpc-mshegdk6',
      subnetId: 'subnet-3la82w45',
    },
  };

  let clusterId;

  test('[generatePwd] should get random password with default length 8', () => {
    const res = generatePwd();
    expect(typeof res).toBe('string');
    expect(res.length).toBe(8);
    expect(isValidPwd(res)).toBe(true);
  });

  test('[generatePwd] should get random password with customize length 6', () => {
    const res = generatePwd(6);
    expect(typeof res).toBe('string');
    expect(res.length).toBe(6);
  });

  // test('[NORMAL] deploy', async () => {
  //   const res = await client.deploy(inputs);
  //   expect(res).toEqual({
  //     dbMode: 'NORMAL',
  //     region: inputs.region,
  //     region: inputs.region,
  //     zone: inputs.zone,
  //     vpcConfig: inputs.vpcConfig,
  //     instanceCount: 2,
  //     adminPassword: expect.stringMatching(pwdReg),
  //     clusterId: expect.stringContaining('cynosdbmysql-'),
  //     connection: {
  //       ip: expect.any(String),
  //       port: 3306,
  //       readList: [
  //         {
  //           ip: expect.any(String),
  //           port: 3306,
  //         },
  //       ],
  //     },
  //   });

  //   ({ clusterId } = res);
  // });

  // test('[NORMAL] remove', async () => {
  //   await sleep(300);
  //   const res = await client.remove({ clusterId });

  //   const detail = await getClusterDetail(client.capi, clusterId);
  //   expect(res).toEqual(true);
  //   expect(detail.Status).toBe('isolated');
  // });
  // test('[NORMAL] offline', async () => {
  //   await sleep(300);
  //   const res = await offlineCluster(client.capi, clusterId);
  //   expect(res).toBeUndefined();
  // });

  test('[SERVERLESS] deploy', async () => {
    inputs.dbMode = 'SERVERLESS';

    const res = await client.deploy(inputs);
    expect(res).toEqual({
      dbMode: 'SERVERLESS',
      region: inputs.region,
      zone: inputs.zone,
      vpcConfig: inputs.vpcConfig,
      instanceCount: 1,
      adminPassword: expect.any(String),
      clusterId: expect.stringContaining('cynosdbmysql-'),
      minCpu: 0.5,
      maxCpu: 2,
      connection: {
        ip: expect.any(String),
        port: 3306,
      },
      instances: [
        {
          id: expect.stringContaining('cynosdbmysql-ins-'),
          name: expect.stringContaining('cynosdbmysql-ins-'),
          role: 'master',
          type: 'rw',
          status: 'running',
        },
      ],
    });

    expect(isValidPwd(res.adminPassword)).toBe(true);
    ({ clusterId } = res);
  });

  test('[SERVERLESS] should enable public access', async () => {
    inputs.clusterId = clusterId;
    inputs.enablePublicAccess = true;

    const res = await client.deploy(inputs);
    expect(res).toEqual({
      dbMode: 'SERVERLESS',
      region: inputs.region,
      zone: inputs.zone,
      vpcConfig: inputs.vpcConfig,
      instanceCount: 1,
      // adminPassword: expect.stringMatching(pwdReg),
      clusterId: expect.stringContaining('cynosdbmysql-'),
      minCpu: 0.5,
      maxCpu: 2,
      connection: {
        ip: expect.any(String),
        port: 3306,
      },
      publicConnection: {
        domain: expect.any(String),
        ip: expect.any(String),
        port: expect.any(Number),
      },
      instances: [
        {
          id: expect.stringContaining('cynosdbmysql-ins-'),
          name: expect.stringContaining('cynosdbmysql-ins-'),
          role: 'master',
          type: 'rw',
          status: 'running',
        },
      ],
    });
  });

  test('[SERVERLESS] should disable public access', async () => {
    inputs.enablePublicAccess = false;

    const res = await client.deploy(inputs);
    expect(res).toEqual({
      dbMode: 'SERVERLESS',
      region: inputs.region,
      zone: inputs.zone,
      vpcConfig: inputs.vpcConfig,
      instanceCount: 1,
      // adminPassword: expect.stringMatching(pwdReg),
      clusterId: expect.stringContaining('cynosdbmysql-'),
      minCpu: 0.5,
      maxCpu: 2,
      connection: {
        ip: expect.any(String),
        port: 3306,
      },
      instances: [
        {
          id: expect.stringContaining('cynosdbmysql-ins-'),
          name: expect.stringContaining('cynosdbmysql-ins-'),
          role: 'master',
          type: 'rw',
          status: 'running',
        },
      ],
    });
    inputs.clusterId = undefined;
  });

  test('[SERVERLESS] remove', async () => {
    await sleep(300);
    const res = await client.remove({ clusterId });

    const detail = await getClusterDetail(client.capi, clusterId);
    expect(res).toEqual(true);
    expect(detail.Status).toBe('isolated');
  });

  test('[SERVERLESS] offline', async () => {
    await sleep(300);
    const res = await offlineCluster(client.capi, clusterId);
    expect(res).toBeUndefined();
  });
});
