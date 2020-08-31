const ScfUtils = require('./index');

class ClientTest {
  async scfTest() {
    const scf = new ScfUtils({
      SecretId: '',
      SecretKey: '',
    });
    const inputs = {
      name: 'express-test',
      code: {
        bucket: 'sls-cloudfunction-ap-guangzhou-code',
        object: 'express_component_5dwuabh-1597994417.zip',
      },
      role: 'SCF_QcsRole',
      handler: 'sl_handler.handler',
      runtime: 'Nodejs12.16',
      region: 'ap-guangzhou',
      description: 'Created by Serverless Framework',
      memorySize: 256,
      timeout: 20,
      tags: {
        mytest: 'abc',
      },
      environment: {
        variables: {
          TEST: 'value',
          ttt: '111',
        },
      },
      eip: true,
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
              bucket:
                'sls-cloudfunction-ap-guangzhou-code-1251556596.cos.ap-guangzhou.myqcloud.com',
              enable: true,
              events: 'cos:ObjectCreated:*',
              filter: {
                prefix: 'aaaasad',
              },
            },
          },
        },
        {
          apigw: {
            parameters: {
              endpoints: [
                {
                  path: '/',
                  method: 'GET',
                },
              ],
            },
          },
        },
      ],
    };

    // 1. deploy test
    const res1 = await scf.deploy(inputs);
    console.log('deploy: ', JSON.stringify(res1));
    console.log('++++++++++++++++++');

    // 2. publish version test
    const res2 = await scf.publishVersion({
      functionName: inputs.name,
      region: 'ap-guangzhou',
    });

    console.log('publishVersion: ', JSON.stringify(res2));
    console.log('++++++++++++++++++');
    await scf.isOperationalStatus(res1.namespace, inputs.name, res2.FunctionVersion);

    // 3. update alias traffic
    const res3 = await scf.updateAliasTraffic({
      functionName: inputs.name,
      region: 'ap-guangzhou',
      traffic: 0.8,
      lastVersion: res2.FunctionVersion,
    });

    console.log('updateAliasTraffic: ', JSON.stringify(res3));
    console.log('++++++++++++++++++');

    // 5. invoke function
    const invokeRes = await scf.invoke({
      functionName: inputs.name,
    });
    console.log('invoke res: ', JSON.stringify(invokeRes));
    console.log('++++++++++++++++++');

    // 4. remove function
    await scf.remove({
      functionName: inputs.name,
    });
  }
}

new ClientTest().scfTest();

process.on('unhandledRejection', (e) => {
  console.log(e);
});
