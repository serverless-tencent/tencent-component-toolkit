import { MpsTriggerInputsParams } from './../../src/modules/triggers/interface';
import { Scf } from '../../src';
import MpsTrigger from '../../src/modules/triggers/mps';

// FIXME: all mps trigger bind fail
describe('Mps', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const client = new MpsTrigger({ credentials, region: process.env.REGION });
  const scfClient = new Scf(credentials, process.env.REGION);

  const data: MpsTriggerInputsParams = {
    qualifier: '$DEFAULT',
    type: 'EditMediaTask',
  };

  const functionName = 'serverless-unit-test';
  const namespace = 'default';

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
      qualifier: '$DEFAULT',
      type: data.type,
      resourceId: expect.stringContaining(`TriggerType/${data.type}`),
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
      qualifier: '$DEFAULT',
      type: data.type,
      resourceId: expect.stringContaining(`TriggerType/${data.type}`),
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
      qualifier: '$DEFAULT',
      type: data.type,
      resourceId: expect.stringContaining(`TriggerType/${data.type}`),
    });
  });

  test('should delete trigger success', async () => {
    const { Triggers = [] } = await scfClient.request({
      Action: 'ListTriggers',
      Namespace: namespace,
      FunctionName: functionName,
      Limit: 100,
    });
    const [exist] = Triggers.filter((item) => item.ResourceId.indexOf(`TriggerType/${data.type}`));
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
  });
});
