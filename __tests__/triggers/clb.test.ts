import { sleep } from '@ygkit/request';
import { CreateClbTriggerOutput } from './../../src/modules/triggers/interface/clb';
import { ClbTriggerInputsParams } from '../../src/modules/triggers/interface';
import { Scf } from '../../src';
import ClbTrigger from '../../src/modules/triggers/clb';

describe('Clb Trigger', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const client = new ClbTrigger({ credentials, region: process.env.REGION });
  const scfClient = new Scf(credentials, process.env.REGION);

  const data: ClbTriggerInputsParams = {
    qualifier: '$DEFAULT',
    loadBalanceId: 'lb-l6golr1k',
    protocol: 'HTTP',
    domain: '81.71.86.84',
    port: 80,
    url: '/trigger-test',
    weight: 20,
  };

  const functionName = 'serverless-unit-test';
  const namespace = 'default';
  let output: CreateClbTriggerOutput;

  test('get listeners', async () => {
    const res = await client.clb.getListenerList(data.loadBalanceId);
    expect(res.length).toBe(1);
  });

  test('create clb trigger', async () => {
    output = await client.create({
      inputs: {
        namespace: namespace,
        functionName: functionName,
        parameters: data,
      },
    });

    expect(output).toEqual({
      listenerId: expect.stringContaining('lbl-'),
      locationId: expect.stringContaining('loc-'),
      namespace: namespace,
      functionName: functionName,
      qualifier: '$DEFAULT',
      ...data,
    });
  });

  test('delete clb trigger', async () => {
    const { Triggers = [] } = await scfClient.request({
      Action: 'ListTriggers',
      Namespace: namespace,
      FunctionName: functionName,
      Limit: 100,
    });
    const [exist] = Triggers.filter((item) => {
      const { ResourceId } = item;

      if (ResourceId.indexOf(`${output.loadBalanceId}/${output.listenerId}/${output.locationId}`)) {
        return true;
      }
      return false;
    });

    const res = await client.delete({
      scf: scfClient,
      inputs: {
        namespace: namespace,
        functionName: functionName,
        triggerDesc: exist.TriggerDesc,
        triggerName: exist.TriggerName,
        qualifier: exist.Qualifier,
      },
    });
    expect(res).toEqual({ requestId: expect.any(String), success: true });
  });

  test('delete clb rule', async () => {
    await sleep(3000);
    const res = await client.clb.deleteRule({
      loadBalanceId: output.loadBalanceId,
      listenerId: output.listenerId,
      locationId: output.locationId,
    });
    expect(res).toBe(true);
  });
});
