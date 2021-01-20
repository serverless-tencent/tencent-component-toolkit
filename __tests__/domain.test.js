const { Domain } = require('../lib');

describe('Domain', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const domain = new Domain(credentials, process.env.REGION);

  test('should get domian success', async () => {
    const res = await domain.check(process.env.SUB_DOMAIN);
    expect(res).toEqual({
      domain: expect.any(String),
      subDomain: expect.any(String),
    });
  });
});
