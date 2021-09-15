import { Scf } from '../../src';

describe('Scf Version', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const scf = new Scf(credentials);

  test('list', async () => {
    const scfList = await scf.version.list({
      functionName: 'koaDemo',
    });
    expect(Array.isArray(scfList.Versions)).toBe(true);
  });
});
