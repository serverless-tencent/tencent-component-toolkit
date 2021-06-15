import { ScfDeployInputs } from '../src/modules/scf/interface';
import { sleep } from '@ygkit/request';
import { Scf } from '../src';

describe('Scf - special', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const client = new Scf(credentials, 'ap-guangzhou');

  const triggers = {
    apigw: {
      apigw: {
        parameters: {
          serviceName: 'serverless_test',
          endpoints: [
            {
              path: '/',
              method: 'GET',
            },
          ],
        },
      },
    },
    timer: {
      timer: {
        name: 'timer',
        parameters: {
          cronExpression: '0 */6 * * * * *',
          enable: true,
          argument: 'mytest argument',
        },
      },
    },
  };

  const events = Object.entries(triggers).map(([, value]) => value);

  const inputs: ScfDeployInputs = {
    // name: `serverless-test-${Date.now()}`,
    name: `serverless-test-fixed`,
    code: {
      bucket: process.env.BUCKET,
      object: 'express_code_pure.zip',
    },
    namespace: 'test',
    role: 'SCF_QcsRole',
    handler: 'sl_handler.handler',
    runtime: 'Nodejs12.16',
    region: 'ap-guangzhou',
    description: 'Created by Serverless',
    memorySize: 256,
    timeout: 20,
    tags: {
      test: 'test',
    },
    environment: {
      variables: {
        TEST: 'value',
      },
    },
    events,
    installDependency: true,
  };

  let outputs;

  test('get demo addresss', async () => {
    const res = await client.scf.getDemoAddress('demo-nhbwbsi4');
    expect(res).toContain(`https://`);
  });
  test('should deploy SCF success', async () => {
    await sleep(3000);
    outputs = await client.deploy(inputs);
    expect(outputs.FunctionName).toBe(inputs.name);
    expect(outputs.Qualifier).toBe('$LATEST');
    expect(outputs.Description).toBe('Created by Serverless');
    expect(outputs.Timeout).toBe(inputs.timeout);
    expect(outputs.MemorySize).toBe(inputs.memorySize);
    expect(outputs.Runtime).toBe(inputs.runtime);
    expect(outputs.InstallDependency).toBe('TRUE');
    expect(outputs.Role).toBe(inputs.role);
  });
  test('should update SCF success', async () => {
    await sleep(3000);
    outputs = await client.deploy(inputs);
    expect(outputs.FunctionName).toBe(inputs.name);
    expect(outputs.Qualifier).toBe('$LATEST');
    expect(outputs.Description).toBe('Created by Serverless');
    expect(outputs.Timeout).toBe(inputs.timeout);
    expect(outputs.MemorySize).toBe(inputs.memorySize);
    expect(outputs.Runtime).toBe(inputs.runtime);
    expect(outputs.InstallDependency).toBe('TRUE');
    expect(outputs.Role).toBe(inputs.role);
  });
  test('[ignoreTriggers = true] update', async () => {
    await sleep(3000);
    inputs.ignoreTriggers = true;
    outputs = await client.deploy(inputs);

    // expect triggers result
    expect(outputs.Triggers).toEqual([]);
  });
  test('should remove Scf success', async () => {
    const res = await client.remove({
      functionName: inputs.name,
      ...outputs,
    });
    expect(res).toEqual(true);
  });
});
