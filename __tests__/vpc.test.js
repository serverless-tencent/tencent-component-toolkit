const { Vpc } = require('../build');
const vpcUtils = require('../build/modules/vpc/utils').default;

describe('Vpc', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const inputs = {
    region: process.env.REGION,
    zone: process.env.ZONE,
    vpcName: 'serverless-test',
    subnetName: 'serverless-test',
    cidrBlock: '10.0.0.0/16',
  };
  const vpc = new Vpc(credentials, process.env.REGION);

  test('should success deploy a vpc', async () => {
    try {
      const res = await vpc.deploy(inputs);
      expect(res).toEqual({
        region: process.env.REGION,
        zone: process.env.ZONE,
        vpcId: expect.stringContaining('vpc-'),
        vpcName: 'serverless-test',
        subnetId: expect.stringContaining('subnet-'),
        subnetName: 'serverless-test',
      });

      inputs.vpcId = res.vpcId;
      inputs.subnetId = res.subnetId;
    } catch (e) {
      console.log(e.message);
      // expect(e.code).toBe('LimitExceeded');
      expect(e.message).toBe(undefined);
    }
  });

  test('should success remove a vpc', async () => {
    if (inputs.vpcId) {
      await vpc.remove(inputs);
      const vpcDetail = await vpcUtils.getVpcDetail(vpc.capi, inputs.vpcId);
      const subnetDetail = await vpcUtils.getSubnetDetail(vpc.capi, inputs.subnetId);

      expect(vpcDetail).not.toBeTruthy();
      expect(subnetDetail).not.toBeTruthy();
    } else {
      expect(true).toBe(true);
    }
  });
});
