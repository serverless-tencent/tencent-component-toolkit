const CamUtils = require('./index');

class ClientTest {
	async camTest() {
		const cam = new CamUtils({
			SecretId: '',
			SecretKey: '',
		});
		const ret = await cam.CheckSCFExcuteRole();
		console.log(ret);
	}
}

new ClientTest().camTest();

process.on('unhandledRejection', (e) => {
  throw e;
});
