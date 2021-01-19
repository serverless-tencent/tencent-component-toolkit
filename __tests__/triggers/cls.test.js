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
    name: 'cls-trigger-test',
    topic: 'cls-topic-trigger-test',
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
      namespace: namespace,
      functionName: functionName,
      maxSize: 100,
      maxWait: 60,
      qualifier: '$DEFAULT',
      topicId: clsOutputs.topicId,
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
      enable: true,
      namespace: namespace,
      functionName: functionName,
      maxSize: 100,
      maxWait: 60,
      qualifier: '$DEFAULT',
      topicId: clsOutputs.topicId,
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
      enable: false,
      namespace: namespace,
      functionName: functionName,
      maxSize: 100,
      maxWait: 60,
      qualifier: '$DEFAULT',
      topicId: clsOutputs.topicId,
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
