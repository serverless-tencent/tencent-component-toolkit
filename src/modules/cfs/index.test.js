const Client = require('./index');
const { sleep } = require('@ygkit/request');

async function runTest() {
  const credentials = {
    SecretId: '',
    SecretKey: '',
  };

  const inputs = {
    fileSystemId: 'cfs-lffp4e73',
    fsName: 'cfs-test',
    region: 'ap-guangzhou',
    zone: 'ap-guangzhou-3',
    netInterface: 'VPC',
    vpc: {
      vpcId: 'vpc-cp54x9m7',
      subnetId: 'subnet-267yufru',
    },
  };
  const client = new Client(credentials, inputs.region);
  const outputs = await client.deploy(inputs);
  console.log('outputs', JSON.stringify(outputs));

  await sleep(1000);
  await client.remove(outputs);
}

runTest();

process.on('unhandledRejection', (e) => {
  throw e;
});
