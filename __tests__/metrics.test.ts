import moment from 'moment';
import { Metrics } from '../src';

function sortDeep<T>(obj: T): void {
  if (Array.isArray(obj)) {
    (obj as Array<any>).sort();
    for (const v of obj) {
      sortDeep(v);
    }
  }

  if (typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      sortDeep(v);
    }
  }
}

describe('Metrics', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const metrics = new Metrics(credentials, {
    funcName: 'serverless-test',
  });

  const rangeStart = '2020-09-09T10:00:00Z';
  const rangeEnd = '2020-09-09T11:00:00Z';

  test('should get metrics data', async () => {
    const res = await metrics.getDatas(rangeStart, rangeEnd, 0xfffffffffff, '+00:00');
    expect(res).toEqual({
      rangeStart: moment(rangeStart).utcOffset('+00:00').format(),
      rangeEnd: moment(rangeEnd).utcOffset('+00:00').format(),
      metrics: expect.any(Array),
    });

    sortDeep(res);
    expect(res).toMatchSnapshot();
  });
});
