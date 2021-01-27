import { ClsTriggerInputsParams } from './../../src/modules/triggers/interface';
import { Cls, Scf } from '../../src';
import ClsTrigger from '../../src/modules/triggers/cls';
import { sleep } from '@ygkit/request';

describe('Cls', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const clsTrigger = new ClsTrigger({ credentials, region: process.env.REGION });
  const cls = new Cls(credentials, process.env.REGION);
  const scf = new Scf(credentials, process.env.REGION);

  const data: ClsTriggerInputsParams = {
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
    clsOutputs = await cls.deploy(clsInputs);
    data.topicId = clsOutputs.topicId;
  });

  afterAll(async () => {
    await sleep(2000);
    await cls.remove(clsOutputs);
  });

  test('should create trigger success', async () => {
    sleep(2000);
    const res = await clsTrigger.create({
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
    sleep(2000);
    data.enable = true;
    const res = await clsTrigger.create({
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
    await sleep(2000);
    data.enable = false;
    const res = await clsTrigger.create({
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
    await sleep(5000);
    const { Triggers = [] } = await scf.request({
      Action: 'ListTriggers',
      Namespace: namespace,
      FunctionName: functionName,
      Limit: 100,
    });
    const [exist] = Triggers.filter((item) => item.ResourceId.indexOf(`topic_id/${data.topicId}`));
    const res = await clsTrigger.delete({
      scf: scf,
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

    const detail = await clsTrigger.get({
      topicId: data.topicId,
    });
    expect(detail).toBeUndefined();
  });
});
