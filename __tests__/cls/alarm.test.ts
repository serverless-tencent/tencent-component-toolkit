import { CreateAlarmOptions, CreateAlarmResult } from '../../src/modules/cls/interface';
import { ClsAlarm } from '../../src';

describe('Cls Alarm', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const client = new ClsAlarm(credentials, process.env.REGION);

  let detail: CreateAlarmResult;

  const options: CreateAlarmOptions = {
    name: 'serverless-unit-test',
    logsetId: '5e822560-4cae-4037-9ec0-a02f8774446f',
    topicId: '6e60b6c7-a98e-4fc8-8ba8-bdfe4ab9c245',
    targets: [
      {
        period: 15,
        query: 'level:error | select count(*) as errCount',
      },
      {
        period: 10,
        query: 'level:error | select count(*) as errCount',
      },
    ],
    monitor: {
      type: 'Period',
      time: 1,
    },
    trigger: {
      condition: '$1.count > 1',
      count: 2,
      period: 15,
    },
    noticeId: 'notice-4271ef11-1b09-459f-8dd1-b0a411757663',
  };

  test('create', async () => {
    const res = await client.create(options);
    expect(res).toEqual({
      ...options,
      id: expect.stringContaining('alarm-'),
    });

    detail = res;
  });

  test('update', async () => {
    const res = await client.create(detail);
    expect(res).toEqual({
      ...options,
      id: expect.stringContaining('alarm-'),
    });
  });

  test('delete', async () => {
    await client.delete({ id: detail.id! });
    const res = await client.get({ id: detail.id });
    expect(res).toBeNull();
  });
});
