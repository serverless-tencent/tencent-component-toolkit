const secret = require('../../../../secret')
const apigwUtils = require('./index')

class ClientTest {
	async apigwTest() {
		const apigw = new apigwUtils({
			SecretId: secret.SecretId,
			SecretKey: secret.SecretKey
		}, ['ap-shanghai', 'ap-guangzhou'])
		const apigwDemo = {
			region: 'ap-guangzhou',
			protocols: ['http', 'https'],
			serviceName: 'serverless',
			environment: 'release',
			endpoints: [
				{
					path: '/',
					protocol: 'HTTP',
					method: 'GET',
					apiName: 'index',
					function: {
						functionName: 'egg-function'
					}
				}
			]
		}
		const result = await apigw.deploy(apigwDemo)
		console.log(JSON.stringify(result))
		await apigw.remove(result)
	}
}

new ClientTest().apigwTest()
