import { ScfDeployInputs } from '../src/modules/scf/interface';
import { Scf } from '../src';

describe('Scf - special', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const scf = new Scf(credentials, 'ap-chongqing');

  const triggers = {
    apigw: {
      apigw: {
        parameters: {
          serviceName: 'serverless_test',
          protocols: ['http', 'https'],
          endpoints: [
            {
              path: '/',
              method: 'ANY',
              function: {
                isIntegratedResponse: true,
              },
            },
          ],
        },
      },
    },
  };

  const events = Object.entries(triggers).map(([, value]) => value);

  const inputs: ScfDeployInputs = {
    name: `serverless-test-http-${Date.now()}`,
    code: {
      bucket: 'test-chongqing',
      object: 'express_http.zip',
    },
    type: 'web',
    namespace: 'default',
    // role: 'SCF_QcsRole',
    runtime: 'Nodejs12.16',
    region: 'ap-chongqing',
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
  };

  let outputs;

  test('should deploy SCF success', async () => {
    outputs = await scf.deploy(inputs);
    expect(outputs.FunctionName).toBe(inputs.name);
    expect(outputs.Type).toBe('HTTP');
    expect(outputs.Qualifier).toBe('$LATEST');
    expect(outputs.Description).toBe('Created by Serverless');
    expect(outputs.Timeout).toBe(inputs.timeout);
    expect(outputs.MemorySize).toBe(inputs.memorySize);
    expect(outputs.Runtime).toBe(inputs.runtime);
  });
  // test('should update SCF success', async () => {
  //   await sleep(3000);
  //   outputs = await scf.deploy(inputs);
  //   expect(outputs.FunctionName).toBe(inputs.name);
  //   expect(outputs.Type).toBe('HTTP');
  //   expect(outputs.Qualifier).toBe('$LATEST');
  //   expect(outputs.Description).toBe('Created by Serverless');
  //   expect(outputs.Timeout).toBe(inputs.timeout);
  //   expect(outputs.MemorySize).toBe(inputs.memorySize);
  //   expect(outputs.Runtime).toBe(inputs.runtime);
  // });
  // test('should remove Scf success', async () => {
  //   const res = await scf.remove({
  //     functionName: inputs.name,
  //     ...outputs,
  //   });
  //   expect(res).toEqual(true);
  // });
});
