const { Tag } = require('../src');

describe('Tag', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const functionName = 'serverless-unit-test';
  const inputs = {
    resource: `qcs::scf:${process.env.REGION}:uin/${process.env.TENCENT_UIN}:namespace/default/function/${functionName}`,
    replaceTags: { tagKey: 'tagValue' },
    deleteTags: { abcdd: 'def' },
  };
  const tag = new Tag(credentials, process.env.REGION);

  test('should success modify tags', async () => {
    const res = await tag.deploy(inputs);
    const [curTag] = await tag.getScfResourceTags({
      functionName: functionName,
    });
    expect(res).toBe(true);
    expect(curTag.TagKey).toBe('tagKey');
    expect(curTag.TagValue).toBe('tagValue');
  });
});
