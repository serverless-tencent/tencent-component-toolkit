import { PostgresqlDeployInputs } from '../src/modules/postgresql/interface';
import { Postgresql } from '../src';
import { getDbInstanceDetail } from '../src/modules/postgresql/utils';
import { sleep } from '@ygkit/request';

describe('Postgresql', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const pg = new Postgresql(credentials, process.env.REGION);

  const tags = [
    {
      key: 'slstest',
      value: 'slstest',
    },
  ];
  const inputs: PostgresqlDeployInputs = {
    region: process.env.REGION,
    zone: process.env.ZONE,
    dBInstanceName: 'serverless-test',
    projectId: 0,
    dBVersion: '10.4',
    dBCharset: 'UTF8',
    vpcConfig: {
      vpcId: process.env.VPC_ID,
      subnetId: process.env.SUBNET_ID,
    },
    extranetAccess: false,
    tags,
  };

  test('should deploy postgresql success', async () => {
    const res = await pg.deploy(inputs);
    expect(res).toEqual({
      region: inputs.region,
      zone: inputs.zone,
      vpcConfig: inputs.vpcConfig,
      dBInstanceName: inputs.dBInstanceName,
      dBInstanceId: expect.stringContaining('postgres-'),
      private: {
        connectionString: expect.stringContaining('postgresql://'),
        host: expect.any(String),
        port: 5432,
        user: expect.stringContaining('tencentdb_'),
        password: expect.any(String),
        dbname: expect.stringContaining('tencentdb_'),
      },
      tags,
    });
    inputs.dBInstanceId = res.dBInstanceId;
  });
  test('should enable public access for postgresql success', async () => {
    inputs.extranetAccess = true;
    const res = await pg.deploy(inputs);
    expect(res).toEqual({
      region: inputs.region,
      zone: inputs.zone,
      vpcConfig: inputs.vpcConfig,
      dBInstanceName: inputs.dBInstanceName,
      dBInstanceId: expect.stringContaining('postgres-'),
      private: {
        connectionString: expect.stringContaining('postgresql://'),
        host: expect.any(String),
        port: 5432,
        user: expect.stringContaining('tencentdb_'),
        password: expect.any(String),
        dbname: expect.stringContaining('tencentdb_'),
      },
      public: {
        connectionString: expect.stringContaining('postgresql://'),
        host: expect.any(String),
        port: expect.any(Number),
        user: expect.stringContaining('tencentdb_'),
        password: expect.any(String),
        dbname: expect.stringContaining('tencentdb_'),
      },
      tags,
    });
  });
  test('should remove postgresql success', async () => {
    await sleep(1000);
    const res = await pg.remove(inputs);

    const detail = await getDbInstanceDetail(pg.capi, inputs.dBInstanceName);
    expect(res).toEqual({});
    expect(detail).toBeUndefined();
  });
});
