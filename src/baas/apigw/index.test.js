const Apigw = require('./index')

async function runTest() {
  const credentials = {
    SecretId: '',
    SecretKey: ''
  }

  const inputs = {
    region: 'ap-guangzhou',
    serviceId: 'service-7i9kk5a8',
    protocols: ['http', 'https'],
    serviceName: 'serverless',
    environment: 'release',
    customDomains: [
      {
        domain: 'fullstack.yugasun.com',
        // TODO: change to your certId
        certificateId: '123456',
        isDefaultMapping: 'FALSE',
        pathMappingSet: [
          {
            path: '/',
            environment: 'release'
          }
        ],
        protocols: ['http', 'https']
      }
    ],
    endpoints: [
      {
        apiId: 'api-a05zvycu',
        path: '/',
        protocol: 'HTTP',
        method: 'GET',
        apiName: 'index',
        function: {
          functionName: 'egg-function'
        },
        usagePlan: {
          usagePlanName: 'slscmp',
          usagePlanDesc: 'sls create',
          maxRequestNum: 1000,
        },
        auth: {
          serviceTimeout: 15,
          secretName: 'secret',
        }

      }
    ]
  }
  const apigw = new Apigw(credentials, inputs.region)
  const outputs = await apigw.deploy(inputs)
  console.log('outputs', JSON.stringify(outputs));


  await apigw.remove(outputs)
}

runTest()
