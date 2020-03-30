const secret = require('../../../../secret')
const TagsUtils = require('./index')

class ClientTest {
  async tagsTest() {
    const tags = new TagsUtils({
      SecretId: secret.SecretId,
      SecretKey: secret.SecretKey
    })
    const tagsDemo = {
      resource: 'qcs::scf:ap-shanghai:uin/100005358439:lam/lam-rooizssdom',
      replaceTags: { abcdd: 'def' },
      deleteTags: {}
    }
    const result = await tags.deploy(tagsDemo)
    console.log(JSON.stringify(result))
  }
}

new ClientTest().tagsTest()

/* 测试结果：
	Modify tags ...
	Modified tags.
	{"logs":{},"error":[]}
*/
