const TagsUtils = require('./index');

class ClientTest {
  async tagsTest() {
    const tags = new TagsUtils({
      SecretId: '',
      SecretKey: '',
    });
    const tagsDemo = {
      resource: 'qcs::scf:ap-shanghai:uin/100005358439:lam/lam-rooizssdom',
      replaceTags: { abcdd: 'def' },
      deleteTags: {},
    };
    const result = await tags.deploy(tagsDemo);
    console.log(JSON.stringify(result));
  }
}

new ClientTest().tagsTest();

process.on('unhandledRejection', (e) => {
  throw e;
});
