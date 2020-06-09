const DomainUtils = require('./index');

class ClientTest {
  async domainTest() {
    const domain = new DomainUtils({
      SecretId: '',
      SecretKey: '',
    });
    const domainDemo = 'test.yuga.chat';
    const result = await domain.check(domainDemo);
    console.log(JSON.stringify(result));
  }
}

new ClientTest().domainTest();

process.on('unhandledRejection', (e) => {
  throw e;
});
