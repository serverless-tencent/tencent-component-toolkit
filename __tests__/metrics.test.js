const { Metrics } = require('../lib');

describe('Metrics', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const metrics = new Metrics(credentials, {
    funcName: 'serverless-test',
  });

  const rangeStart = '2020-09-09 10:00:00';
  const rangeEnd = '2020-09-09 11:00:00';

  test('should get metrics data', async () => {
    const res = await metrics.getDatas(rangeStart, rangeEnd);
    expect(res).toEqual({
      rangeStart: rangeStart,
      rangeEnd: rangeEnd,
      metrics: expect.any(Array),
    });
  });
});
