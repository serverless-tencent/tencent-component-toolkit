import { Account } from '../../src';

describe('Account', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const account = new Account(credentials);

  test('get', async () => {
    const res = await account.get();
    expect(res).toEqual({
      ownerUin: +process.env.TENCENT_UIN,
      uin: +process.env.TENCENT_UIN,
      appId: +process.env.TENCENT_APP_ID,
      account: expect.any(String),
      userType: expect.any(String),
      type: expect.any(String),
      area: expect.any(String),
      tel: expect.any(String),
    });
  });
});
