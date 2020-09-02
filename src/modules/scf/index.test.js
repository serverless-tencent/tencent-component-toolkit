const ScfUtils = require('./index');
const CFS = require('../cfs');

class ClientTest {
  async scfTest() {
    const credentials = {
      SecretId: '',
      SecretKey: '',
    };
    const scf = new ScfUtils(credentials);
    const inputs = {
      name: 'express-test',
      code: {
        bucket: 'sls-cloudfunction-ap-guangzhou-code',
        object: 'express_component_5dwuabh-1598513206.zip',
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
      vpcConfig: {
        vpcId: 'vpc-cp54x9m7',
        subnetId: 'subnet-267yufru',
      },
      cfs: [
        {
          localMountDir: '/mnt/',
          remoteMountDir: '/',
        },
      ],
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

    // 0. deploy cfs
    const cfsInputs = {
      fsName: 'cfs-test',
      region: 'ap-guangzhou',
      zone: 'ap-guangzhou-3',
      netInterface: 'VPC',
      vpc: {
        vpcId: 'vpc-cp54x9m7',
        subnetId: 'subnet-267yufru',
      },
    };
    const cfsClient = new CFS(credentials, inputs.region);
    const cfsRes = await cfsClient.deploy(cfsInputs);
    console.log('cfs deploy: ', JSON.stringify(cfsRes));
    console.log('++++++++++++++++++');
    inputs.cfs[0].cfsId = cfsRes.fileSystemId;


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

    // 5. remove cfs
    await cfsClient.remove(cfsRes);
  }
}

new ClientTest().scfTest();

process.on('unhandledRejection', (e) => {
  console.log(e);
});
