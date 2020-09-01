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
  const res1 = await layer.deploy(inputs);
  console.log('deploy result: ', res1);
  console.log('+++++++++++++++++++++');

  // get layer
  const res2 = await layer.getLayerDetail(inputs.name, res1.version);
  console.log('get detail: ', res2);
  console.log('+++++++++++++++++++++');

  await sleep(1000);
  await layer.remove({
    name: inputs.name,
    version: res1.version,
  });

}

runTest();

process.on('unhandledRejection', (e) => {
  throw e;
});
