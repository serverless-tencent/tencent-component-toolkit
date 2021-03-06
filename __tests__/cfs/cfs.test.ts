import { CFSDeployInputs } from '../../src/modules/cfs/interface';
import { sleep } from '@ygkit/request';
import { Cfs } from '../../src';
import utils from '../../src/modules/cfs/utils';

describe('Cfs', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };

  const inputs: CFSDeployInputs = {
    fsName: 'cfs-test',
    region: 'ap-guangzhou',
    zone: 'ap-guangzhou-3',
    netInterface: 'VPC',
    vpc: {
      vpcId: process.env.CFS_VPC_ID,
      subnetId: process.env.CFS_SUBNET_ID,
    },
    tags: [
      {
        key: 'slstest',
        value: 'slstest',
      },
    ],
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
      tags: inputs.tags,
    });
    inputs.fileSystemId = res.fileSystemId;
  });

  test('should remove CFS success', async () => {
    await sleep(5000);
    const res = await cfs.remove({
      ...inputs,
      fileSystemId: inputs.fileSystemId,
    });
    const detail = await utils.getCfs(cfs.capi, inputs.fileSystemId);
    expect(res).toEqual({});
    expect(detail).toBeUndefined();
  });
});
