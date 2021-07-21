import { sleep } from '@ygkit/request';
import { Scf } from '../../src';
import { ScfDeployInputs } from '../../src/modules/scf/interface';

describe('Scf', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const scf = new Scf(credentials);

  const inputs: ScfDeployInputs = {
    name: `serverless-test-${Date.now()}`,
    code: {
      bucket: process.env.BUCKET,
      object: 'express_code.zip',
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
  };
  let outputs;

  test('[asyncRunEnable and traceEnable] create', async () => {
    await sleep(3000);
    delete inputs.cls;
    inputs.asyncRunEnable = true;
    inputs.traceEnable = true;
    inputs.msgTTL = 3600;
    inputs.retryNum = 0;
    outputs = await scf.deploy(inputs);

    const asyncConfig = await scf.scf.getAsyncRetryConfig(inputs, {} as any);

    expect(outputs.AsyncRunEnable).toBe('TRUE');
    expect(outputs.TraceEnable).toBe('TRUE');
    expect(asyncConfig).toEqual({
      AsyncTriggerConfig: {
        MsgTTL: 3600,
        RetryConfig: [
          { ErrorCode: ['default'], RetryNum: 0, RetryInterval: 60 },
          { ErrorCode: ['432'], RetryNum: -1, RetryInterval: 60 },
        ],
      },
      RequestId: expect.any(String),
    });
  });
  test('[asyncRunEnable and traceEnable] update', async () => {
    await sleep(3000);
    inputs.asyncRunEnable = true;
    inputs.traceEnable = false;
    outputs = await scf.deploy(inputs);

    expect(outputs.AsyncRunEnable).toBe('TRUE');
    expect(outputs.TraceEnable).toBe('FALSE');
  });
  test('[asyncRunEnable and traceEnable] remove', async () => {
    const res = await scf.remove({
      functionName: inputs.name,
      ...outputs,
    });
    expect(res).toEqual(true);
  });
});
