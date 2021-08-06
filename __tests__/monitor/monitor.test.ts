import { Monitor } from '../../src';

describe('Monitor', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const monitor = new Monitor(credentials, process.env.REGION);

  test('get monitor data', async () => {
    const res = await monitor.get({
      functionName: 'serverless-unit-test',
      metric: 'Invocation',
    });

    expect(res).toEqual({
      StartTime: expect.any(String),
      EndTime: expect.any(String),
      Period: 60,
      MetricName: 'Invocation',
      DataPoints: [
        {
          Dimensions: [
            { Name: 'functionName', Value: 'serverless-unit-test' },
            { Name: 'namespace', Value: 'default' },
          ],
          Timestamps: expect.any(Array),
          Values: expect.any(Array),
        },
      ],
      RequestId: expect.any(String),
    });
  });

  test('[inverval] get monitor data', async () => {
    const res = await monitor.get({
      functionName: 'serverless-unit-test',
      metric: 'Invocation',
      interval: 3600,
    });

    expect(res).toEqual({
      StartTime: expect.any(String),
      EndTime: expect.any(String),
      Period: 60,
      MetricName: 'Invocation',
      DataPoints: [
        {
          Dimensions: [
            { Name: 'functionName', Value: 'serverless-unit-test' },
            { Name: 'namespace', Value: 'default' },
          ],
          Timestamps: expect.any(Array),
          Values: expect.any(Array),
        },
      ],
      RequestId: expect.any(String),
    });
  });
  test('[period] get monitor data', async () => {
    const res = await monitor.get({
      functionName: 'serverless-unit-test',
      metric: 'Invocation',
      period: 300,
    });

    expect(res).toEqual({
      StartTime: expect.any(String),
      EndTime: expect.any(String),
      Period: 300,
      MetricName: 'Invocation',
      DataPoints: [
        {
          Dimensions: [
            { Name: 'functionName', Value: 'serverless-unit-test' },
            { Name: 'namespace', Value: 'default' },
          ],
          Timestamps: expect.any(Array),
          Values: expect.any(Array),
        },
      ],
      RequestId: expect.any(String),
    });
  });
});
