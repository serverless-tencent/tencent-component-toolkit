import { sleep } from '@ygkit/request';
import Asw from '../src/modules/asw';
import { UpdateOptions, CreateResult } from './../src/modules/asw/interface';

describe('Account', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const client = new Asw(credentials);

  const input = JSON.stringify({
    key: 'value',
  });

  const options: {
    definition: string;
    name: string;
    resourceId?: string;
    role?: string;
    input?: string;
  } = {
    definition: JSON.stringify({
      Comment: 'Serverless Test',
      StartAt: 'Hello',
      States: {
        Hello: { Type: 'Pass', Comment: '传递', Next: 'World' },
        World: { Type: 'Pass', Comment: '传递', End: true },
      },
    }),
    name: 'serverless-test',
    input,
  };

  let executeName: string;
  let createResult: CreateResult;

  test('create', async () => {
    const res = await client.create(options);
    expect(res).toEqual({
      requestId: expect.any(String),
      resourceId: expect.any(String),
      isNewRole: expect.any(Boolean),
      roleName: expect.stringContaining('serverless-test_'),
    });
    createResult = res;
  });

  test('get', async () => {
    const res = await client.get(createResult.resourceId);

    expect(res.FlowServiceName).toBe(options.name);
    expect(res.Type).toBe('STANDARD');
    expect(res.Definition).toBe(options.definition);
  });

  test('update', async () => {
    options.resourceId = createResult.resourceId;
    options.role = createResult.roleName;
    const res = await client.update(options as UpdateOptions);
    expect(res).toEqual({
      requestId: expect.any(String),
      resourceId: createResult.resourceId,
      isNewRole: expect.any(Boolean),
      roleName: expect.stringContaining('serverless-test_'),
    });
  });

  test('execute', async () => {
    const res = await client.execute({
      resourceId: createResult.resourceId,
      name: 'serverless',
      input,
    });

    expect(res).toEqual({
      requestId: expect.any(String),
      resourceId: createResult.resourceId,
      executeName: expect.stringContaining('qrn:qcs:asw:'),
    });

    ({ executeName } = res);
  });

  test('getExecuteState', async () => {
    // 等待执行完成
    await sleep(5000);
    const res = await client.getExecuteState(executeName);

    expect(res.ExecutionResourceName).toBe(executeName);
    expect(res.Name).toBe('serverless');
    expect(res.Input).toBe(input);
  });

  test('delete', async () => {
    const res = await client.delete(createResult.resourceId);
    expect(res).toEqual({
      requestId: expect.any(String),
      resourceId: createResult.resourceId,
    });

    // 删除测试创建的角色
    if (createResult.isNewRole) {
      await client.cam.DeleteRole(createResult.roleName);
    }
  });
});
