const Layer = require('./index');
const { sleep } = require('@ygkit/request');

async function runTest() {
  const credentials = {
    SecretId: '',
    SecretKey: '',
  };

  const inputs = {
    region: 'ap-guangzhou',
    name: 'layer-test',
    bucket: 'sls-cloudfunction-ap-guangzhou-code',
    object: 'node_modules.zip',
    description: 'Layer created by Serverless Component',
    runtimes: ['Nodejs10.15', 'Nodejs12.16'],
  };
  const layer = new Layer(credentials, inputs.region);
  const outputs = await layer.deploy(inputs);
  console.log('outputs', JSON.stringify(outputs));

  await sleep(1000);
  await layer.remove(outputs);
}

runTest();

process.on('unhandledRejection', (e) => {
  throw e;
});
