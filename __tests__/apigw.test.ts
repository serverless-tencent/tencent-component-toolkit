import { ApigwDeployInputs, ApigwDeployOutputs } from './../src/modules/apigw/interface';
import { Apigw } from '../src';

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

describe('apigw', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const inputs: ApigwDeployInputs = {
    protocols: ['http', 'https'],
    serviceName: 'serverless_test',
    environment: 'release',
    netTypes: ['OUTER'],
    // customDomains: [
    //   {
    //     domain: 'test.yuga.chat',
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
    //     isForcedHttps: true
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
          functionName: 'serverless-unit-test',
        },
        isBase64Encoded: true,
        isBase64Trigger: true,
        base64EncodedTriggerRules: [
          {
            name: 'Accept',
            value: ['application/x-vpeg005', 'application/xhtml+xml'],
          },
          {
            name: 'Content_Type',
            value: ['application/x-vpeg005', 'application/xhtml+xml'],
          },
        ],
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
          transportFunctionName: 'serverless-unit-test',
          registerFunctionName: 'serverless-unit-test',
        },
      },
      // below two api is for oauth2.0 test
      {
        path: '/oauth',
        protocol: 'HTTP',
        method: 'GET',
        apiName: 'oauthapi',
        authType: 'OAUTH',
        businessType: 'OAUTH',
        serviceType: 'HTTP',
        serviceConfig: {
          method: 'GET',
          path: '/check',
          url: 'http://10.64.47.103:9090',
        },
        oauthConfig: {
          loginRedirectUrl: 'http://10.64.47.103:9090/code',
          publicKey: process.env.API_PUBLIC_KEY,
          tokenLocation: 'method.req.header.authorization',
          // tokenLocation: 'method.req.header.cookie',
        },
      },
      {
        path: '/oauthwork',
        protocol: 'HTTP',
        method: 'GET',
        apiName: 'business',
        authType: 'OAUTH',
        businessType: 'NORMAL',
        authRelationApi: {
          path: '/oauth',
          method: 'GET',
        },
        serviceType: 'MOCK',
        serviceMockReturnMessage: 'helloworld',
      },
    ],
  };
  const apigw = new Apigw(credentials, process.env.REGION);
  let outputs: ApigwDeployOutputs;

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
          authType: 'NONE',
          businessType: 'NORMAL',
          isBase64Encoded: true,
        },
        {
          path: '/mo',
          method: 'GET',
          apiName: 'mo',
          internalDomain: expect.any(String),
          apiId: expect.stringContaining('api-'),
          created: true,
          authType: 'NONE',
          businessType: 'NORMAL',
          isBase64Encoded: false,
        },
        {
          path: '/auto',
          method: 'GET',
          apiName: 'auto-http',
          internalDomain: expect.any(String),
          apiId: expect.stringContaining('api-'),
          created: true,
          authType: 'NONE',
          businessType: 'NORMAL',
          isBase64Encoded: false,
        },
        {
          path: '/ws',
          method: 'GET',
          apiName: 'ws-test',
          internalDomain: expect.any(String),
          apiId: expect.stringContaining('api-'),
          created: true,
          authType: 'NONE',
          businessType: 'NORMAL',
          isBase64Encoded: false,
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
          authType: 'NONE',
          businessType: 'NORMAL',
          isBase64Encoded: false,
        },
        {
          path: '/oauth',
          method: 'GET',
          apiName: 'oauthapi',
          apiId: expect.stringContaining('api-'),
          created: true,
          authType: 'OAUTH',
          businessType: 'OAUTH',
          internalDomain: expect.any(String),
          isBase64Encoded: false,
        },
        {
          path: '/oauthwork',
          method: 'GET',
          apiName: 'business',
          apiId: expect.stringContaining('api-'),
          created: true,
          authType: 'OAUTH',
          businessType: 'NORMAL',
          authRelationApiId: expect.stringContaining('api-'),
          internalDomain: expect.any(String),
          isBase64Encoded: false,
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
          authType: 'SECRET',
          businessType: 'NORMAL',
          usagePlan: {
            created: true,
            secrets: {
              created: true,
              secretIds: expect.any(Array),
            },
            usagePlanId: expect.stringContaining('usagePlan-'),
          },
          isBase64Encoded: true,
        },
        {
          path: '/mo',
          method: 'GET',
          apiName: 'mo',
          internalDomain: expect.any(String),
          apiId: expect.stringContaining('api-'),
          created: true,
          authType: 'NONE',
          businessType: 'NORMAL',
          isBase64Encoded: false,
        },
        {
          path: '/auto',
          method: 'GET',
          apiName: 'auto-http',
          internalDomain: expect.any(String),
          apiId: expect.stringContaining('api-'),
          created: true,
          authType: 'NONE',
          businessType: 'NORMAL',
          isBase64Encoded: false,
        },
        {
          path: '/ws',
          method: 'GET',
          apiName: 'ws-test',
          internalDomain: expect.any(String),
          apiId: expect.stringContaining('api-'),
          authType: 'NONE',
          businessType: 'NORMAL',
          created: true,
          isBase64Encoded: false,
        },
        {
          path: '/wsf',
          method: 'GET',
          apiName: 'ws-scf',
          internalDomain: expect.stringContaining(
            'http://set-websocket.cb-common.apigateway.tencentyun.com',
          ),
          apiId: expect.stringContaining('api-'),
          authType: 'NONE',
          businessType: 'NORMAL',
          created: true,
          isBase64Encoded: false,
        },
        {
          path: '/oauth',
          method: 'GET',
          apiName: 'oauthapi',
          apiId: expect.stringContaining('api-'),
          created: true,
          authType: 'OAUTH',
          businessType: 'OAUTH',
          internalDomain: expect.any(String),
          isBase64Encoded: false,
        },
        {
          path: '/oauthwork',
          method: 'GET',
          apiName: 'business',
          apiId: expect.stringContaining('api-'),
          created: true,
          authType: 'OAUTH',
          businessType: 'NORMAL',
          authRelationApiId: expect.stringContaining('api-'),
          internalDomain: expect.any(String),
          isBase64Encoded: false,
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

  test.only('[Apigw] Bind CustomDomain success', async () => {
    const apigwInputs = deepClone(inputs);
    apigwInputs.serviceId = 'service-ogn8szl0';
    apigwInputs.endpoints = [
      {
        apiId: 'api-i84p7rla',
        path: '/',
        protocol: 'HTTP',
        method: 'GET',
        apiName: 'index',
        function: {
          functionName: 'serverless-unit-test',
        },
        isBase64Encoded: true,
        isBase64Trigger: true,
        base64EncodedTriggerRules: [
          {
            name: 'Accept',
            value: ['application/x-vpeg005', 'application/xhtml+xml'],
          },
          {
            name: 'Content_Type',
            value: ['application/x-vpeg005', 'application/xhtml+xml'],
          },
        ],
      },
    ];
    apigwInputs.customDomains = [
      {
        domain: 'test-1.sls.plus',
        // certificateId: 'cWOJJjax',
        isDefaultMapping: false,
        pathMappingSet: [
          {
            path: '/',
            environment: 'release',
          },
        ],
        protocols: ['http'],
      },
      {
        domain: 'test-2.sls.plus',
        // certificateId: 'cWOJJjax',
        isDefaultMapping: false,
        pathMappingSet: [
          {
            path: '/',
            environment: 'release',
          },
        ],
        protocols: ['http'],
      },
    ];
    const deployOutputs = await apigw.deploy(apigwInputs);

    const deployOutputsAgain = await apigw.deploy(apigwInputs);

  //   console.log({ deployOutputs, deployOutputsAgain });
  //   await apigw.remove(deployOutputs);
  // });
});
