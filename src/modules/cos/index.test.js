const Client = require('./index');

async function runTest() {
  const APP_ID = '1251556596';
  const bucketName = 'test-bucket';
  const cos = new Client({
    SecretId: '',
    SecretKey: '',
  });
  const inputs = {
    bucket: `${bucketName}-${APP_ID}`,
    force: true,
    acl: {
      permissions: 'private',
    },
    tags: [
      {
        key: 'test',
        value: 'abcd',
      },
    ],
    rules: [
      {
        status: 'Enabled',
        id: 'deleteObject',
        filter: '',
        expiration: { days: '10' },
        abortIncompleteMultipartUpload: { daysAfterInitiation: '10' },
      },
    ],
  };
  const result = await cos.deploy(inputs);
  console.log(result);

  await cos.upload({
    bucket: `${bucketName}-${APP_ID}`,
    dir: '../../utils/',
  });

  await cos.remove({
    bucket: `${bucketName}-${APP_ID}`,
  });

}

runTest();

process.on('unhandledRejection', (e) => {
  console.log(e);
});

