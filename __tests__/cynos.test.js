const { Cynosdb } = require('../src');
const { getClusterDetail, sleep, generatePwd, PWD_CHARS } = require('../src/modules/cynosdb/utils');

const pwdReg = new RegExp(`[${PWD_CHARS}]{8,64}`);

describe('Cynosdb', () => {
  jest.setTimeout(600000);
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const client = new Cynosdb(credentials, 'ap-guangzhou');

  const inputs = {
    region: 'ap-guangzhou',
    zone: 'ap-guangzhou-4',
    vpcConfig: {
      vpcId: 'vpc-p2dlmlbj',
      subnetId: 'subnet-a1v3k07o',
    },
  };

  test('[generatePwd] should get random password with default length 8', () => {
    const res = generatePwd();
    expect(typeof res).toBe('string');
    expect(res.length).toBe(8);
  });

  test('[generatePwd] should get random password with customize length 6', () => {
    const res = generatePwd(6);
    expect(typeof res).toBe('string');
    expect(res.length).toBe(6);
  });

  test('should deploy Cynosdb success', async () => {
    const res = await client.deploy(inputs);
    expect(res).toEqual({
      region: inputs.region,
      zone: inputs.zone,
      vpcConfig: inputs.vpcConfig,
      instanceCount: 2,
      adminPassword: expect.stringMatching(pwdReg),
      clusterId: expect.stringContaining('cynosdbmysql-'),
      connection: {
        ip: expect.any(String),
        port: 3306,
        readList: [
          {
            ip: expect.any(String),
            port: 3306,
          },
        ],
      },
    });

    inputs.clusterId = res.clusterId;
  });

  test('should remove Cynosdb success', async () => {
    await sleep(1000);
    const res = await client.remove(inputs);

    const detail = await getClusterDetail(client.capi, inputs.clusterId);
    expect(res).toEqual(true);
    expect(detail).toBeUndefined();
  });
});
