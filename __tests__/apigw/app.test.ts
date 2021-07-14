import { ApigwDeployInputs, ApigwDeployOutputs } from '../../src/modules/apigw/interface';
import { Apigw } from '../../src';
import { deepClone } from '../../src/utils';

describe('apigw app', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const inputs: ApigwDeployInputs = {
    protocols: ['http', 'https'],
    serviceName: 'serverless_test',
    environment: 'release',
    netTypes: ['OUTER'],
    endpoints: [
      {
        path: '/appauth',
        protocol: 'HTTP',
        method: 'POST',
        apiName: 'appauth',
        authType: 'APP',
        app: {
          name: 'serverless_app_test',
          description: 'Created by serverless test',
        },
        function: {
          functionName: 'serverless-unit-test',
        },
      },
    ],
  };
  const apigw = new Apigw(credentials, process.env.REGION);
  let outputs: ApigwDeployOutputs;

  // 由于自定义域名必须 ICP 备案，所以这里测试域名不会通过，具体测试请使用
  test('bind app auth success', async () => {
    const apigwInputs = deepClone(inputs);
    outputs = await apigw.deploy(apigwInputs);

    expect(outputs.apiList).toEqual([
      {
        path: '/appauth',
        internalDomain: expect.any(String),
        method: 'POST',
        apiName: 'appauth',
        apiId: expect.stringContaining('api-'),
        created: true,
        authType: 'APP',
        businessType: 'NORMAL',
        isBase64Encoded: false,
        url: expect.stringContaining('http'),
        app: {
          description: 'Created by serverless test',
          id: expect.stringContaining('app-'),
          name: 'serverless_app_test',
        },
      },
    ]);
  });
});
