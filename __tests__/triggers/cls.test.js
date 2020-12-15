const { Cls, Scf } = require('../../src');
const ClsTrigger = require('../../src/modules/triggers/cls');

describe('Cls', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const client = new ClsTrigger({ credentials, region: process.env.REGION });
  const clsClient = new Cls(credentials, process.env.REGION);
  const scfClient = new Scf(credentials, process.env.REGION);

  const data = {
    qualifier: '$DEFAULT',
    maxWait: 60,
    maxSize: 100,
  };

  const functionName = 'serverless-unit-test';
  const namespace = 'default';

  const clsInputs = {
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

  let clsOutputs;

  beforeAll(async () => {
    clsOutputs = await clsClient.deploy(clsInputs);
    data.topicId = clsOutputs.topicId;
  });

  afterAll(async () => {
    await clsClient.remove(clsOutputs);
  });

  test('should create trigger success', async () => {
    const res = await client.create({
      inputs: {
        namespace: namespace,
        functionName: functionName,
        parameters: data,
      },
    });
    expect(res).toEqual({
      name_space: namespace,
      function_name: functionName,
      max_size: 100,
      max_wait: 60,
      qualifier: '$DEFAULT',
      topic_id: clsOutputs.topicId,
    });
  });

  test('should enable trigger success', async () => {
    data.enable = true;
    const res = await client.create({
      inputs: {
        namespace: namespace,
        functionName: functionName,
        parameters: data,
      },
    });
    expect(res).toEqual({
      name_space: namespace,
      function_name: functionName,
      effective: true,
      max_size: 100,
      max_wait: 60,
      qualifier: '$DEFAULT',
      topic_id: clsOutputs.topicId,
    });
  });

  test('should disable trigger success', async () => {
    data.enable = false;
    const res = await client.create({
      inputs: {
        namespace: namespace,
        functionName: functionName,
        parameters: data,
      },
    });
    expect(res).toEqual({
      name_space: 'default',
      function_name: 'serverless-unit-test',
      effective: false,
      max_size: 100,
      max_wait: 60,
      qualifier: '$DEFAULT',
      topic_id: clsOutputs.topicId,
    });
  });

  test('should delete trigger success', async () => {
    const { Triggers = [] } = await scfClient.request({
      Action: 'ListTriggers',
      Namespace: namespace,
      FunctionName: functionName,
      Limit: 100,
    });
    const [exist] = Triggers.filter((item) => item.ResourceId.indexOf(`topic_id/${data.topicId}`));
    const res = await client.delete({
      scf: scfClient,
      inputs: {
        namespace: namespace,
        functionName: functionName,
        type: exist.Type,
        triggerDesc: exist.TriggerDesc,
        triggerName: exist.TriggerName,
        qualifier: exist.Qualifier,
      },
    });
    expect(res).toEqual({ requestId: expect.any(String), success: true });

    const detail = await client.get({
      topicId: data.topicId,
    });
    expect(detail).toBeUndefined();
  });
});
