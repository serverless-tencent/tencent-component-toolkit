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
  test('create apigw with app auth success', async () => {
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

  test('update apigw without app auth success', async () => {
    const apigwInputs = deepClone(inputs);
    delete apigwInputs.endpoints[0].app;
    apigwInputs.serviceId = outputs.serviceId;
    apigwInputs.endpoints[0].apiId = outputs.apiList[0].apiId;
    outputs = await apigw.deploy(apigwInputs);

    const apiAppRes: {
      ApiAppApiSet: {
        ApiAppId: string;
        ApiAppName: string;
        ApiId: string;
        ServiceId: string;
        ApiRegion: string;
        EnvironmentName: string;
        AuthorizedTime: string;
      }[];
    } = await apigw.request({
      Action: 'DescribeApiBindApiAppsStatus',
      ServiceId: outputs.serviceId,
      ApiIds: [outputs.apiList[0].apiId],
    });
    expect(apiAppRes.ApiAppApiSet).toEqual([]);
  });

  test('remove app auth success', async () => {
    outputs.apiList[0].created = true;
    await apigw.remove(outputs);

    const detail = await apigw.request({
      Action: 'DescribeApi',
      serviceId: outputs.serviceId,
      apiId: outputs.apiList[0].apiId,
    });

    expect(detail).toBeNull();
  });
});
