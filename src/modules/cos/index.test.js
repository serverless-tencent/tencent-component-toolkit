const CosUtils = require('./index');

class ClientTest {
	async cosTest() {
    const APP_ID = '1251556596';
    const bucketName = 'test-bucket';
		const cos = new CosUtils({
			SecretId: '',
			SecretKey: '',
		});
		const cosDemo = {
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
		const result = await cos.deploy(cosDemo);
		console.log(JSON.stringify(result));
		console.log(result);


		await cos.upload({
			bucket: `${bucketName}-${APP_ID}`,
			dir: '../../utils/',
		});

		await cos.remove({
			bucket: `${bucketName}-${APP_ID}`,
		});

	}
}

new ClientTest().cosTest();
