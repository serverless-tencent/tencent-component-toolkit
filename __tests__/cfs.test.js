const { sleep } = require('@ygkit/request');
const { Cfs } = require('../src');
const apis = require('../src/modules/cfs/apis');

describe('Cfs', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const inputs = {
    fsName: 'cfs-test',
    region: 'ap-guangzhou',
    zone: 'ap-guangzhou-3',
    netInterface: 'VPC',
    vpc: {
      vpcId: process.env.CFS_VPC_ID,
      subnetId: process.env.CFS_SUBNET_ID,
    },
  };
  const cfs = new Cfs(credentials, process.env.REGION);

  test('should deploy CFS success', async () => {
    const res = await cfs.deploy(inputs);
    expect(res).toEqual({
      region: process.env.REGION,
      fsName: inputs.fsName,
      pGroupId: 'pgroupbasic',
      netInterface: 'VPC',
      protocol: 'NFS',
      storageType: 'SD',
      fileSystemId: expect.stringContaining('cfs-'),
    });
    inputs.fileSystemId = res.fileSystemId;
  });

  test('should remove CFS success', async () => {
    await sleep(1000);
    const res = await cfs.remove(inputs);
    const detail = await apis.getCfs(cfs.capi, inputs.fileSystemId);
    expect(res).toEqual({});
    expect(detail).toBeUndefined();
  });
});
