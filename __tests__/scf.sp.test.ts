import { ScfDeployInputs } from '../src/modules/scf/interface';
import { sleep } from '@ygkit/request';
import { Scf } from '../src';

describe('Scf - singapore', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const scf = new Scf(credentials, 'ap-guangzhou');

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

  test('should deploy SCF success', async () => {
    await sleep(3000);
    outputs = await scf.deploy(inputs);
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
    outputs = await scf.deploy(inputs);
    expect(outputs.FunctionName).toBe(inputs.name);
    expect(outputs.Qualifier).toBe('$LATEST');
    expect(outputs.Description).toBe('Created by Serverless');
    expect(outputs.Timeout).toBe(inputs.timeout);
    expect(outputs.MemorySize).toBe(inputs.memorySize);
    expect(outputs.Runtime).toBe(inputs.runtime);
    expect(outputs.InstallDependency).toBe('TRUE');
    expect(outputs.Role).toBe(inputs.role);
  });
  test('should remove Scf success', async () => {
    const res = await scf.remove({
      functionName: inputs.name,
      ...outputs,
    });
    expect(res).toEqual(true);
  });
});
