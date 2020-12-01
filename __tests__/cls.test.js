const { Cls } = require('../src');

describe('Cls', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const client = new Cls(credentials, process.env.REGION, 600000);

  let outputs = {};

  const inputs = {
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

  test('should deploy cls success', async () => {
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

  test('should remove cls success', async () => {
    await client.remove(outputs);

    const detail = await client.cls.getLogset({
      logset_id: outputs.logsetId,
    });
    expect(detail.logset_id).toBeUndefined();
    expect(detail.error).toEqual({
      message: expect.any(String),
    });
  });
});
