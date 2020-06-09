const CnsUtils = require('./index');

class ClientTest {
  async cnsTest() {
    const cns = new CnsUtils({
      SecretId: '',
      SecretKey: '',
    });
    const cnsDemo = {
      domain: 'yuga.chat',
      records: [
        {
          subDomain: ['abc', 'cde'],
          recordType: 'CNAME',
          recordLine: ['移动', '电信'],
          value: 'cname1.dnspod.com',
          ttl: 600,
          mx: 10,
          status: 'enable',
        },
        {
          subDomain: 'xyz',
          recordType: 'CNAME',
          recordLine: '默认',
          value: 'cname2.dnspod.com',
          ttl: 600,
          mx: 10,
          status: 'enable',
        },
      ],
    };
    const result = await cns.deploy(cnsDemo);
    console.log(JSON.stringify(result));
    console.log(result);
    const delRes = await cns.remove({ deleteList: result.records });
    console.log(delRes);
  }
}

new ClientTest().cnsTest();

process.on('unhandledRejection', (e) => {
  throw e;
});
