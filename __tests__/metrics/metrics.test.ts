import moment from 'moment';
import { Metrics } from '../../src';
import { getYestoday } from '../../src/utils';

describe('Metrics', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const metrics = new Metrics(credentials, {
    funcName: 'serverless-unit-test',
  });

  const yestoday = getYestoday();
  const rangeStart = `${yestoday} 10:00:00`;
  const rangeEnd = `${yestoday} 11:00:00`;

  test('should get metrics data', async () => {
    const res = await metrics.getDatas(rangeStart, rangeEnd, 0xfffffffffff);
    expect(res).toEqual({
      rangeStart: moment(rangeStart).format('YYYY-MM-DD HH:mm:ss'),
      rangeEnd: moment(rangeEnd).format('YYYY-MM-DD HH:mm:ss'),
      metrics: expect.any(Array),
    });
  });
});
