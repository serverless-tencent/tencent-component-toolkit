const secret = require('../../../../secret')
const CamUtils = require('./index')

class ClientTest {
	async camTest() {
		const cam = new CamUtils({
			SecretId: secret.SecretId,
			SecretKey: secret.SecretKey
		})
		const ret = await cam.CheckSCFExcuteRole()
		console.log(ret)
	}
}

new ClientTest().camTest()
