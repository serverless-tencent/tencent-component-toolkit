const Postgresql = require('./index');

async function runTest() {
  const credentials = {
    SecretId: '',
    SecretKey: '',
  };

  // support region: ap-guangzhou-2, ap-beijing-3, ap-shanghai-2
  const inputs = {
    region: 'ap-guangzhou',
    zone: 'ap-guangzhou-2',
    dBInstanceName: 'serverlessTest',
    projectId: 0,
    dBVersion: '10.4',
    dBCharset: 'UTF8',
    vpcConfig: {
      vpcId: 'vpc-id3zoj6r',
      subnetId: 'subnet-kwc49rti',
    },
    extranetAccess: true,
  };
  const pg = new Postgresql(credentials, inputs.region);
  // deploy
  const outputs = await pg.deploy(inputs);
  console.log(outputs);
  // remove
  await pg.remove(outputs);
}

runTest();

process.on('unhandledRejection', (e) => {
  console.log(e);

});
