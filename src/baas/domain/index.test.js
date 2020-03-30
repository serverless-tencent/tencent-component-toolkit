const secret = require('../../../../secret')
const DomainUtils = require('./index')

class ClientTest {
  async domainTest() {
    const domain = new DomainUtils({
      SecretId: secret.SecretId,
      SecretKey: secret.SecretKey
    })
    const domainDemo = 'abc.anycodes.cn'
    const result = await domain.check(domainDemo)
    console.log(JSON.stringify(result))
  }
}

new ClientTest().domainTest()

/* 测试结果：
	{"domain":"anycodes.cn","subDomain":"abc"}
*/
