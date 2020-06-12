const Apigw = require('./index');

async function runTest() {
  const credentials = {
    SecretId: '',
    SecretKey: '',
  };

  const inputs = {
    region: 'ap-guangzhou',
    serviceId: 'service-miuysd64',
    protocols: ['http', 'https'],
    serviceName: 'serverless',
    environment: 'release',
    customDomains: [
      {
        domain: 'test.yugasun.com',
        // TODO: change to your certId
        certificateId: 'cWOJJjax',
        isDefaultMapping: 'true',
        pathMappingSet: [
          {
            path: '/',
            environment: 'release',
          },
        ],
        protocols: ['http', 'https'],
      },
    ],
    endpoints: [
      {
        apiId: 'api-4n94mte6',
        path: '/',
        protocol: 'HTTP',
        method: 'GET',
        apiName: 'index',
        function: {
          functionName: 'egg-function',
        },
        usagePlan: {
          usagePlanId: 'usagePlan-e3atrucv',
          usagePlanName: 'slscmp',
          usagePlanDesc: 'sls create',
          maxRequestNum: 1000,
        },
        auth: {
          serviceTimeout: 15,
          secretName: 'secret',
          secretIds: ['AKID7k1J4024e6gc3Twou1m9smQZrb2OBSyUp4S3'],
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
        apiName: 'auto-http 000',
        method: 'GET',
        serviceType: 'HTTP',
        serviceConfig: {
          url: 'http://www.baidu.com',
          path: '/test',
          method: 'GET',
        },
      },
    ],
  };
  const apigw = new Apigw(credentials, inputs.region);
  const outputs = await apigw.deploy(inputs);
  console.log('outputs', JSON.stringify(outputs));


  await apigw.remove(outputs);
}

runTest();

process.on('unhandledRejection', (e) => {
  console.log(e);
});
