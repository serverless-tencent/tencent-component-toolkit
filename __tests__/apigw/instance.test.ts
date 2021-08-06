import { ApigwDeployInputs, ApigwDeployOutputs } from '../../src/modules/apigw/interface';
import { Apigw } from '../../src';
import { deepClone } from '../../src/utils';

describe('apigw isolate instance app', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const inputs: ApigwDeployInputs = {
    protocols: ['http', 'https'],
    serviceName: 'serverless_isolate_instance_test',
    environment: 'release',
    netTypes: ['OUTER'],
    instanceId: 'instance-9gwj7tc8',
    endpoints: [],
  };
  const apigw = new Apigw(credentials, process.env.REGION);
  let outputs: ApigwDeployOutputs;

  test('create apigw success', async () => {
    const apigwInputs = deepClone(inputs);
    outputs = await apigw.deploy(apigwInputs);
    expect(outputs).toEqual({
      created: true,
      serviceId: expect.stringContaining('service-'),
      serviceName: 'serverless_isolate_instance_test',
      subDomain: `${outputs.serviceId}-1303241281.gz.apigw.tencentcs.com`,
      protocols: 'http&https',
      environment: 'release',
      apiList: [],
      instanceId: 'instance-9gwj7tc8',
      url: `https://${outputs.serviceId}-1303241281.gz.apigw.tencentcs.com`,
    });
  });

  test('remove success', async () => {
    await apigw.remove(outputs);

    const detail = await apigw.request({
      Action: 'DescribeService',
      serviceId: outputs.serviceId,
    });

    expect(detail).toBeNull();
  });
});
