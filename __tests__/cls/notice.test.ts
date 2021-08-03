import { CreateNoticeOptions, CreateNoticeResult } from '../../src/modules/cls/interface';
import { ClsNotice } from '../../src';

describe('Cls Alarm', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const client = new ClsNotice(credentials, process.env.REGION);

  let detail: CreateNoticeResult;

  const options: CreateNoticeOptions = {
    name: 'serverless-unit-test',
    type: 'All',
    receivers: [
      {
        start: '00:00:00',
        end: '23:59:59',
        type: 'Uin',
        ids: [Number(process.env.NOTICE_UIN)],
        channels: ['Email', 'Sms', 'WeChat', 'Phone'],
      },
    ],
    webCallbacks: [
      {
        type: 'WeCom',
        url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx',
        body: '【腾讯云】日志服务CLS监控告警\n您好，您账号（账号UIN：{{.UIN}}，昵称：{{.User}}）下的日志服务告警策略（策略ID：{{.AlarmId}}，策略名：{{.AlarmName}}）触发告警：\n监控对象：{{.TopicName}}\n触发条件：持续满足条件{{.Condition}}达{{.ConsecutiveAlertNums}}次\n触发时间：最近于{{.TriggerTime}}发现异常\n您可以登录腾讯云日志服务控制台查看。',
      },
      {
        type: 'Http',
        headers: ['Content-Type: application/json'],
        method: 'POST',
        url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx',
        body: '{\n  "UIN":"{{.UIN}}",\n  "User":"{{.User}}}",\n  "AlarmID":"{{.AlarmID}}",\n  "AlarmName":"{{.AlarmName}}",\n  "TopicName":"{{.TopicName}}",\n  "Condition":"{{.Condition}}",\n  "TriggerTime":"{{.TriggerTime}}"\n}',
      },
    ],
  };

  test('create', async () => {
    const res = await client.create(options);
    expect(res).toEqual({
      ...options,
      id: expect.stringContaining('notice-'),
    });

    detail = res;
  });

  test('update', async () => {
    const res = await client.create(detail);
    expect(res).toEqual({
      ...options,
      id: expect.stringContaining('notice-'),
    });
  });

  test('delete', async () => {
    await client.delete({ id: detail.id! });
    const res = await client.get({ id: detail.id });
    expect(res).toBeNull();
  });
});
