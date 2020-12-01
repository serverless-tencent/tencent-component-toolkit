const { Apigw } = require('../src');

const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

describe('apigw', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const inputs = {
    protocols: ['http', 'https'],
    serviceName: 'serverless_test',
    environment: 'release',
    netTypes: ['OUTER'],
    // customDomains: [
    //   {
    //     domain: 'test.yugasun.com',
    //     // TODO: change to your certId
    //     certificateId: 'cWOJJjax',
    //     isDefaultMapping: false,
    //     pathMappingSet: [
    //       {
    //         path: '/',
    //         environment: 'release',
    //       },
    //     ],
    //     protocols: ['http', 'https'],
    //   },
    // ],
    usagePlan: {
      usagePlanId: 'usagePlan-8bbr8pup',
      usagePlanName: 'slscmp',
      usagePlanDesc: 'sls create',
      maxRequestNum: 1000,
    },
    auth: {
      secretName: 'authName',
    },
    endpoints: [
      {
        apiId: 'api-i84p7rla',
        path: '/',
        protocol: 'HTTP',
        method: 'GET',
        apiName: 'index',
        function: {
          functionName: 'egg-function',
        },
      },
      {
        path: '/mo',
        protocol: 'HTTP',
        method: 'GET',
        apiName: 'mo',
        serviceType: 'MOCK',
        serviceMockReturnMessage: 'test mock response',
      },
      {
        path: '/auto',
        protocol: 'HTTP',
        apiName: 'auto-http',
        method: 'GET',
        serviceType: 'HTTP',
        serviceConfig: {
          url: 'http://www.baidu.com',
          path: '/test',
          method: 'GET',
        },
      },
      {
        path: '/ws',
        protocol: 'WEBSOCKET',
        apiName: 'ws-test',
        method: 'GET',
        serviceType: 'WEBSOCKET',
        serviceConfig: {
          url: 'ws://yugasun.com',
          path: '/',
          method: 'GET',
        },
      },
      {
        path: '/wsf',
        protocol: 'WEBSOCKET',
        apiName: 'ws-scf',
        method: 'GET',
        serviceType: 'SCF',
        function: {
          functionNamespace: 'default',
          functionQualifier: '$DEFAULT',
          transportFunctionName: 'fullstack-api',
          registerFunctionName: 'myRestAPI',
        },
      },
    ],
  };
  const apigw = new Apigw(credentials, process.env.REGION);
  let outputs;

  test('[Environment UsagePlan] should deploy a apigw success', async () => {
    const apigwInputs = deepClone(inputs);
    outputs = await apigw.deploy(apigwInputs);
    expect(outputs).toEqual({
      created: true,
      serviceId: expect.stringContaining('service-'),
      serviceName: 'serverless_test',
      subDomain: expect.stringContaining('.apigw.tencentcs.com'),
      protocols: 'http&https',
      environment: 'release',
      usagePlan: {
        created: true,
        secrets: {
          created: true,
          secretIds: expect.any(Array),
        },
        usagePlanId: expect.stringContaining('usagePlan-'),
      },
      apiList: [
        {
          path: '/',
          internalDomain: expect.any(String),
          method: 'GET',
          apiName: 'index',
          apiId: expect.stringContaining('api-'),
          created: true,
        },
        {
          path: '/mo',
          method: 'GET',
          apiName: 'mo',
          internalDomain: expect.any(String),
          apiId: expect.stringContaining('api-'),
          created: true,
        },
        {
          path: '/auto',
          method: 'GET',
          apiName: 'auto-http',
          internalDomain: expect.any(String),
          apiId: expect.stringContaining('api-'),
          created: true,
        },
        {
          path: '/ws',
          method: 'GET',
          apiName: 'ws-test',
          internalDomain: expect.any(String),
          apiId: expect.stringContaining('api-'),
          created: true,
        },
        {
          path: '/wsf',
          method: 'GET',
          apiName: 'ws-scf',
          internalDomain: expect.stringContaining(
            'http://set-websocket.cb-common.apigateway.tencentyun.com',
          ),
          apiId: expect.stringContaining('api-'),
          created: true,
        },
      ],
    });
  });

  test('[Environment UsagePlan] should remove apigw success', async () => {
    await apigw.remove(outputs);
    const detail = await apigw.request({
      Action: 'DescribeService',
      ServiceId: outputs.serviceId,
    });

    expect(detail).toBeNull();
  });

  test('[Api UsagePlan] should deploy a apigw success', async () => {
    const apigwInputs = deepClone(inputs);
    apigwInputs.endpoints[0].usagePlan = apigwInputs.usagePlan;
    apigwInputs.endpoints[0].auth = apigwInputs.auth;
    delete apigwInputs.usagePlan;
    delete apigwInputs.auth;

    outputs = await apigw.deploy(apigwInputs);
    expect(outputs).toEqual({
      created: true,
      serviceId: expect.stringContaining('service-'),
      serviceName: 'serverless_test',
      subDomain: expect.stringContaining('.apigw.tencentcs.com'),
      protocols: 'http&https',
      environment: 'release',
      apiList: [
        {
          path: '/',
          internalDomain: expect.any(String),
          method: 'GET',
          apiName: 'index',
          apiId: expect.stringContaining('api-'),
          created: true,
          usagePlan: {
            created: true,
            secrets: {
              created: true,
              secretIds: expect.any(Array),
            },
            usagePlanId: expect.stringContaining('usagePlan-'),
          },
        },
        {
          path: '/mo',
          method: 'GET',
          apiName: 'mo',
          internalDomain: expect.any(String),
          apiId: expect.stringContaining('api-'),
          created: true,
        },
        {
          path: '/auto',
          method: 'GET',
          apiName: 'auto-http',
          internalDomain: expect.any(String),
          apiId: expect.stringContaining('api-'),
          created: true,
        },
        {
          path: '/ws',
          method: 'GET',
          apiName: 'ws-test',
          internalDomain: expect.any(String),
          apiId: expect.stringContaining('api-'),
          created: true,
        },
        {
          path: '/wsf',
          method: 'GET',
          apiName: 'ws-scf',
          internalDomain: expect.stringContaining(
            'http://set-websocket.cb-common.apigateway.tencentyun.com',
          ),
          apiId: expect.stringContaining('api-'),
          created: true,
        },
      ],
    });
  });

  test('[Api UsagePlan] should remove apigw success', async () => {
    await apigw.remove(outputs);
    const detail = await apigw.request({
      Action: 'DescribeService',
      ServiceId: outputs.serviceId,
    });

    expect(detail).toBeNull();
  });
});
