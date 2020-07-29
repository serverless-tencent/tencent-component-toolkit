const ScfUtils = require('./index');

class ClientTest {
	async scfTest() {
		const scf = new ScfUtils({
			SecretId: '',
			SecretKey: '',
		}, ['ap-shanghai', 'ap-guangzhou']);
		const scfDemo = {
			name: 'myFunctionttest',
			handler: 'index.main_handler',
			runtime: 'Python3.6',
			role: 'SCF_PythonLogsRole',
			// eip: true,
			region: 'ap-shanghai',
			description: 'My Serverless Function',
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
					apigw: {
						name: 'serverless',
						parameters: {
							protocols: ['http'],
							serviceName: 'serverless',
							description: 'the serverless service',
							environment: 'release',
							endpoints: [{
								path: '/users',
								method: 'POST',
							}],
						},

					},
				},
			],
			'ap-shanghai': {
				code: {
					bucket: 'sls-cloudfunction-ap-shanghai-code',
					object: 'sls-cloudfunction-default-Album_Add_Album-1585359218.zip',
				},
			},
			'ap-guangzhou': {
				code: {
					bucket: 'sls-cloudfunction-ap-guangzhou',
					object: 'sls-cloudfunction-default-hello_world-1584670117.zip',
				},
			},
		};
		const result = await scf.deploy(scfDemo);
		console.log(JSON.stringify(result));
		// console.log(await scf.invoke(result.FunctionName))
		await scf.remove(result);
	}
}

new ClientTest().scfTest();
