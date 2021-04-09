import { VpcDeployInputs, DefaultVpcItem } from './../src/modules/vpc/interface';
import { Vpc } from '../src';
import vpcUtils from '../src/modules/vpc/utils';

describe('Vpc', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const inputs: VpcDeployInputs = {
    region: process.env.REGION,
    zone: process.env.ZONE,
    vpcName: 'serverless-test',
    subnetName: 'serverless-test',
    cidrBlock: '10.0.0.0/16',
  };
  // const vpc = new Vpc(credentials, process.env.REGION);
  const vpc = new Vpc(credentials, 'ap-shanghai');

  let defaultVpcDetail: DefaultVpcItem = null;

  test('createDefaultVpc', async () => {
    const res = await vpcUtils.createDefaultVpc(vpc.capi, 'ap-shanghai-2');
    defaultVpcDetail = res;

    expect(res).toEqual({
      VpcId: expect.stringContaining('vpc-'),
      SubnetId: expect.stringContaining('subnet-'),
      VpcName: 'Default-VPC',
      SubnetName: 'Default-Subnet',
      CidrBlock: expect.any(String),
      DhcpOptionsId: expect.any(String),
      DnsServerSet: expect.any(Array),
      DomainName: expect.any(String),
    });
  });

  test('getDefaultVpc', async () => {
    const res = await vpcUtils.getDefaultVpc(vpc.capi);
    expect(res.VpcName).toEqual('Default-VPC');
    expect(res.VpcId).toEqual(defaultVpcDetail.VpcId);
  });

  test('getDefaultSubnet', async () => {
    const res = await vpcUtils.getDefaultSubnet(vpc.capi, defaultVpcDetail.VpcId);
    expect(res.SubnetName).toEqual('Default-Subnet');
    expect(res.SubnetId).toEqual(defaultVpcDetail.SubnetId);
  });

  test('deploy vpc', async () => {
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

  test('remove vpc', async () => {
    if (inputs.vpcId) {
      await vpc.remove({
        vpcId: inputs.vpcId,
        subnetId: inputs.subnetId,
      });
      const vpcDetail = await vpcUtils.getVpcDetail(vpc.capi, inputs.vpcId);
      const subnetDetail = await vpcUtils.getSubnetDetail(vpc.capi, inputs.subnetId);

      expect(vpcDetail).not.toBeTruthy();
      expect(subnetDetail).not.toBeTruthy();
    } else {
      expect(true).toBe(true);
    }
  });
});
