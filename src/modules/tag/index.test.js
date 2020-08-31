const TagsUtils = require('./index');

class ClientTest {
  async run() {
    const tags = new TagsUtils({
      SecretId: '',
      SecretKey: '',
    });
    const tagsDemo = {
      resource: 'qcs::scf:ap-guangzhou:uin/739360256:lam/lam-rooizssdom',
      replaceTags: { abcdd: 'def' },
      deleteTags: {},
    };
    const result = await tags.deploy(tagsDemo);
    console.log(JSON.stringify(result));
  }
}

new ClientTest().run();

process.on('unhandledRejection', (e) => {
  throw e;
});
