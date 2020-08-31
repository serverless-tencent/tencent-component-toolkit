const Client = require('./index');

class ClientTest {
  async run() {
    const domain = new Client({
      SecretId: '',
      SecretKey: '',
    });
    const domainDemo = 'test.yuga.chat';
    const result = await domain.check(domainDemo);
    console.log(result);
  }
}

new ClientTest().run();

process.on('unhandledRejection', (e) => {
  throw e;
});
