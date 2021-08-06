import { DeployInputs, DeployOutputs } from '../../src/modules/cls/interface';
import { Scf } from '../../src';
import { Cls } from '../../src';
import { sleep } from '@ygkit/request';

describe('Cls', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const scf = new Scf(credentials, process.env.REGION);
  const client = new Cls(credentials, process.env.REGION);

  let outputs: DeployOutputs;

  const alarms = [
    {
      name: 'cls-alarm-test',
      targets: [
        {
          period: 15,
          query: '* | select count(*) as errCount',
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
    },
  ];

  const inputs: DeployInputs = {
    region: 'ap-guangzhou',
    name: 'cls-test',
    topic: 'cls-topic-test',
    period: 7,
    rule: {
      full_text: {
        case_sensitive: true,
        tokenizer: '!@#%^&*()_="\', <>/?|\\;:\n\t\r[]{}',
      },
      key_value: {
        case_sensitive: true,
        keys: ['SCF_RetMsg'],
        types: ['text'],
        tokenizers: [' '],
      },
    },
  };

  test('deploy cls', async () => {
    const res = await client.deploy(inputs);
    expect(res).toEqual({
      region: process.env.REGION,
      name: inputs.name,
      topic: inputs.topic,
      logsetId: expect.any(String),
      topicId: expect.any(String),
    });

    outputs = res;
  });

  test('deploy cls with alarms', async () => {
    inputs.alarms = alarms;
    const res = await client.deploy(inputs);
    expect(res).toEqual({
      region: process.env.REGION,
      name: inputs.name,
      topic: inputs.topic,
      logsetId: expect.any(String),
      topicId: expect.any(String),
      alarms: [
        {
          id: expect.stringContaining('alarm-'),
          logsetId: expect.any(String),
          topicId: expect.any(String),
          ...alarms[0],
        },
      ],
    });

    outputs = res;
  });

  test('remove cls', async () => {
    await sleep(5000);
    await client.remove(outputs);

    const detail = await client.cls.getTopic({
      topic_id: outputs.topicId,
    });

    expect(detail.topicId).toBeUndefined();
    expect(detail.error).toEqual({
      message: expect.any(String),
    });
  });

  test('search log', async () => {
    await scf.invoke({
      namespace: 'default',
      functionName: 'serverless-unit-test',
    });

    await sleep(5000);

    const res = await client.getLogList({
      functionName: 'serverless-unit-test',
      namespace: 'default',
      qualifier: '$LATEST',
      logsetId: '125d5cd7-caee-49ab-af9b-da29aa09d6ab',
      topicId: 'e9e38c86-c7ba-475b-a852-6305880d2212',
      interval: 3600,
    });
    expect(res).toBeInstanceOf(Array);
  });
});
