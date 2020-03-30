const Apigw = require('./index')

async function runTest() {
  const credentials = {
    SecretId: '',
    SecretKey: ''
  }

  const inputs = {
    region: 'ap-guangzhou',
    serviceId: 'service-dy3d9qlq',
    protocols: ['http', 'https'],
    serviceName: 'serverless',
    environment: 'release',
    customDomains: [
      {
        domain: 'fullstack.yugasun.com',
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
        path: '/',
        protocol: 'HTTP',
        method: 'GET',
        apiName: 'index',
        function: {
          functionName: 'egg-function'
        }
      }
    ]
  }
  const apigw = new Apigw(credentials, inputs.region)
  const outputs = await apigw.deploy(inputs)

  await apigw.remove(outputs)
}

runTest()
