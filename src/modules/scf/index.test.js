const ScfUtils = require('./index');

class ClientTest {
  async scfTest() {
    const scf = new ScfUtils({
      // SecretId: process.env.TENCENT_SECRET_ID,
      // SecretKey: process.env.TENCENT_SECRET_KEY,
      SecretId: '',
      SecretKey: '',
    });
    const scfDemo = {
      name: 'express-test',
      code: {
        bucket: 'sls-cloudfunction-ap-guangzhou-code',
        object: 'express_component_3gainhv-1591085216.zip',
      },
      handler: 'sl_handler.handler',
      runtime: 'Nodejs12.16',
      region: 'ap-guangzhou',
      description: 'Created by Serverless Framework',
      memorySize: '256',
      timeout: '20',
      tags: {
        mytest: 'abc',
      },
      environment: {
        variables: {
          TEST: 'value',
        },
      },
      events: [
        {
          timer: {
            name: 'timer',
            parameters: {
              cronExpression: '*/6 * * * *',
              enable: true,
              argument: 'mytest argument',
            },
          },
        },
        {
          cos: {
            name: 'sls-cloudfunction-ap-guangzhou-code-1251556596.cos.ap-guangzhou.myqcloud.com',
            parameters: {
              bucket: 'sls-cloudfunction-ap-guangzhou-code-1251556596.cos.ap-guangzhou.myqcloud.com',
              enable: true,
              events: 'cos:ObjectCreated:*',
              filter:{
                prefix: 'aaaasad',
              },
            },
          },
        },
        {
          apigw: {
            name: 'serverless_test',
            parameters: {
              protocols: ['http'],
              description: 'Created by Serverless Framework',
              environment: 'release',
              endpoints: [{
                path: '/',
                method: 'GET',
              }],
            },

          },
        },
      ],
    };
    const result = await scf.deploy(scfDemo);
    try{
      console.log(JSON.stringify(result));
    } catch (e) {
      console.log(e);
    }
    // console.log(await scf.invoke(result.FunctionName))
    await scf.remove(result);
  }
}

new ClientTest().scfTest();

process.on('unhandledRejection', (e) => {
  console.log(e);
});
