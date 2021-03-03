import moment from 'moment';
import { Metrics } from '../src';

function format<T>(obj: T): void {
  if (Array.isArray(obj)) {
    (obj as Array<any>).sort();
    for (const v of obj) {
      format(v);
    }
  }

  if (typeof obj === 'object') {
    if (obj['type'] === 'timestamp') {
      obj['values'] = [];
    }
    for (const v of Object.values(obj)) {
      format(v);
    }
  }
}

describe('Metrics', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const metrics = new Metrics(credentials, {
    funcName: 'serverless-unit-test',
  });

  const rangeStart = '2020-09-09 10:00:00';
  const rangeEnd = '2020-09-09 11:00:00';

  test('should get metrics data', async () => {
    const res = await metrics.getDatas(rangeStart, rangeEnd, 0xfffffffffff);
    expect(res).toEqual({
      rangeStart: moment(rangeStart).format('YYYY-MM-DD HH:mm:ss'),
      rangeEnd: moment(rangeEnd).format('YYYY-MM-DD HH:mm:ss'),
      metrics: expect.any(Array),
    });

    format(res);
    expect(res).toMatchSnapshot();
  });
});
