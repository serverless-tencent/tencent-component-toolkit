import { CynosdbDeployInputs } from '../../src/modules/cynosdb/interface';
import { Cynosdb } from '../../src';
import {
  getClusterDetail,
  sleep,
  generatePwd,
  isValidPwd,
  isSupportServerlessZone,
} from '../../src/modules/cynosdb/utils';

describe('Cynosdb', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const region = 'ap-guangzhou';
  const client = new Cynosdb(credentials, region);

  const tags = [
    {
      key: 'slstest',
      value: 'slstest',
    },
  ];

  const inputs: CynosdbDeployInputs = {
    region,
    zone: 'ap-guangzhou-4',
    vpcConfig: {
      vpcId: 'vpc-p2dlmlbj',
      subnetId: 'subnet-a1v3k07o',
    },
    tags,
  };

  let clusterId;

  test('[isSupportServerlessZone] is support serverless zone', async () => {
    const res = await isSupportServerlessZone(client.capi, inputs.zone);

    expect(res).toEqual({
      IsSupportNormal: 1,
      IsSupportServerless: 1,
      ZoneId: expect.any(Number),
      Zone: inputs.zone,
      ZoneZh: '广州四区',
      Region: region,
      DbType: 'MYSQL',
    });
  });

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
      tags,
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
      // adminPassword: expect.any(String),
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
      tags,
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
      // adminPassword: expect.any(String),
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
      tags,
    });
    inputs.clusterId = undefined;
  });

  test('[SERVERLESS] remove', async () => {
    await sleep(300);
    const res = await client.remove({ clusterId });

    const detail = await getClusterDetail(client.capi, clusterId);
    expect(res).toEqual(true);
    expect(detail).toBeUndefined();
  });
});
