import { ScfDeployInputs } from '../src/modules/scf/interface';
import { sleep } from '@ygkit/request';
import { Scf } from '../src';

describe('Scf - singapore', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const scf = new Scf(credentials, 'ap-singapore');

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
      bucket: 'test-singapore',
      object: 'express_code.zip',
    },
    namespace: 'test',
    role: 'SCF_QcsRole',
    handler: 'sl_handler.handler',
    runtime: 'Nodejs12.16',
    region: 'ap-singapore',
    description: 'Created by Serverless Framework',
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
    await sleep(3000);
    outputs = await scf.deploy(inputs);
    expect(outputs).toEqual({
      Qualifier: '$LATEST',
      Description: 'Created by Serverless Framework',
      Timeout: inputs.timeout,
      InitTimeout: expect.any(Number),
      MemorySize: inputs.memorySize,
      Runtime: inputs.runtime,
      VpcConfig: { VpcId: '', SubnetId: '' },
      Environment: {
        Variables: [
          {
            Key: 'TEST',
            Value: 'value',
          },
        ],
      },
      Handler: inputs.handler,
      AsyncRunEnable: 'FALSE',
      LogType: expect.any(String),
      TraceEnable: 'FALSE',
      UseGpu: 'FALSE',
      Role: inputs.role,
      CodeSize: 0,
      FunctionVersion: '$LATEST',
      FunctionName: inputs.name,
      Namespace: 'test',
      InstallDependency: 'FALSE',
      Status: 'Active',
      AvailableStatus: 'Available',
      StatusDesc: expect.any(String),
      FunctionId: expect.stringContaining('lam-'),
      L5Enable: 'FALSE',
      EipConfig: { EipFixed: 'FALSE', Eips: expect.any(Array) },
      ModTime: expect.any(String),
      AddTime: expect.any(String),
      Layers: [],
      DeadLetterConfig: { Type: '', Name: '', FilterType: '' },
      OnsEnable: 'FALSE',
      PublicNetConfig: {
        PublicNetStatus: 'ENABLE',
        EipConfig: { EipStatus: 'DISABLE', EipAddress: expect.any(Array) },
      },
      Triggers: expect.any(Array),
      ClsLogsetId: expect.any(String),
      ClsTopicId: expect.any(String),
      CodeInfo: '',
      CodeResult: 'success',
      CodeError: '',
      ErrNo: 0,
      Tags: [
        {
          Key: 'test',
          Value: 'test',
        },
      ],
      AccessInfo: { Host: '', Vip: '' },
      Type: 'Event',
      CfsConfig: {
        CfsInsList: [],
      },
      StatusReasons: [],
      RequestId: expect.any(String),
    });
  });
  test('should update SCF success', async () => {
    await sleep(3000);
    outputs = await scf.deploy(inputs);
    expect(outputs).toEqual({
      Qualifier: '$LATEST',
      Description: 'Created by Serverless Framework',
      Timeout: inputs.timeout,
      InitTimeout: expect.any(Number),
      MemorySize: inputs.memorySize,
      Runtime: inputs.runtime,
      VpcConfig: { VpcId: '', SubnetId: '' },
      Environment: {
        Variables: [
          {
            Key: 'TEST',
            Value: 'value',
          },
        ],
      },
      Handler: inputs.handler,
      AsyncRunEnable: 'FALSE',
      LogType: expect.any(String),
      TraceEnable: 'FALSE',
      UseGpu: 'FALSE',
      Role: inputs.role,
      CodeSize: 0,
      FunctionVersion: '$LATEST',
      FunctionName: inputs.name,
      Namespace: 'test',
      InstallDependency: 'FALSE',
      Status: 'Active',
      AvailableStatus: 'Available',
      StatusDesc: expect.any(String),
      FunctionId: expect.stringContaining('lam-'),
      L5Enable: 'FALSE',
      EipConfig: { EipFixed: 'FALSE', Eips: expect.any(Array) },
      ModTime: expect.any(String),
      AddTime: expect.any(String),
      Layers: [],
      DeadLetterConfig: { Type: '', Name: '', FilterType: '' },
      OnsEnable: 'FALSE',
      PublicNetConfig: {
        PublicNetStatus: 'ENABLE',
        EipConfig: { EipStatus: 'DISABLE', EipAddress: expect.any(Array) },
      },
      Triggers: expect.any(Array),
      ClsLogsetId: expect.any(String),
      ClsTopicId: expect.any(String),
      CodeInfo: '',
      CodeResult: 'success',
      CodeError: '',
      ErrNo: 0,
      Tags: [
        {
          Key: 'test',
          Value: 'test',
        },
      ],
      AccessInfo: { Host: '', Vip: '' },
      Type: 'Event',
      CfsConfig: {
        CfsInsList: [],
      },
      StatusReasons: [],
      RequestId: expect.any(String),
    });
  });
  test('should remove Scf success', async () => {
    const res = await scf.remove({
      functionName: inputs.name,
      ...outputs,
    });
    expect(res).toEqual(true);
  });
});
