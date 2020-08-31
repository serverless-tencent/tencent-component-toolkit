const Vpc = require('./index');

async function runTest() {
  const credentials = {
    SecretId: '',
    SecretKey: '',
  };
  const inputs = {
    region: 'ap-guangzhou',
    zone: 'ap-guangzhou-2',
    subnetId: 'subnet-3ofyccsy',
    subnetName: 'serverless1',
    cidrBlock: '10.0.0.0/16',
  };
  const vpc = new Vpc(credentials, inputs.region);
  const outputs = await vpc.deploy(inputs);

  await vpc.remove(outputs);
}

runTest();

process.on('unhandledRejection', (e) => {
  console.log(e);
});
