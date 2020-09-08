const { Apigw } = require('../src');

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
        usagePlan: {
          usagePlanId: 'usagePlan-8bbr8pup',
          usagePlanName: 'slscmp',
          usagePlanDesc: 'sls create',
          maxRequestNum: 1000,
        },
        auth: {
          serviceTimeout: 15,
          secretName: 'authName',
          secretIds: ['xxx'],
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

  test('should deploy a apigw success', async () => {
    outputs = await apigw.deploy(inputs);
    expect(outputs).toEqual({
      created: true,
      serviceId: expect.stringContaining('service-'),
      serviceName: 'serverless_test',
      subDomain: expect.stringContaining('.apigw.tencentcs.com'),
      protocols: inputs.protocols,
      environment: 'release',
      apiList: [{
        path: '/',
        bindType: 'API',
        internalDomain: null,
        method: 'GET',
        apiName: 'index',
        apiId: expect.stringContaining('api-'),
        created: true,
        usagePlan:  {
          created: true,
          secrets:  {
            'created': false,
            'secretIds':  [],
          },
          usagePlanId: expect.stringContaining('usagePlan-'),
        },
      },{
        path: '/mo',
        method: 'GET',
        apiName: 'mo',
        internalDomain: null,
        apiId: expect.stringContaining('api-'),
        created: true,
      },{
        path: '/auto',
        method: 'GET',
        apiName: 'auto-http',
        internalDomain: null,
        apiId: expect.stringContaining('api-'),
        created: true,
      },{
        path: '/ws',
        method: 'GET',
        apiName: 'ws-test',
        internalDomain: null,
        apiId: expect.stringContaining('api-'),
        created: true,
      },{
        path: '/wsf',
        method: 'GET',
        apiName: 'ws-scf',
        internalDomain: expect.stringContaining('http://set-websocket.cb-common.apigateway.tencentyun.com'),
        apiId: expect.stringContaining('api-'),
        created: true,
      }],
    });

  });

  test('should remove apigw success', async () => {
    await apigw.remove(outputs);
    const detail = await apigw.request({
      Action: 'DescribeService',
      ServiceId: outputs.serviceId,
    });

    expect(detail).toBeNull();
  });
});

