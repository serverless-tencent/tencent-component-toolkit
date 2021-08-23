import { Scf } from '../../src';
import { ScfDeployInputs } from '../../src/modules/scf/interface';

describe('Scf Smooth Update', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const scf = new Scf(credentials);
  const inputs: ScfDeployInputs = {
    name: `serverless-test-concurrency-${Date.now()}`,
    code: {
      bucket: process.env.BUCKET,
      object: 'express_code.zip',
    },
    runtime: 'Nodejs12.16',
    region: 'ap-guangzhou',
    namespace: 'test',
    type: 'web',
  };

  test('Deploy Function', async () => {
    const res = await scf.deploy(inputs);
    console.log(res);
  });

  test('Reserve funciton concurrency', async () => {
    await scf.concurrency.setReserved({
      functionName: inputs.name,
      namespace: inputs.namespace,
      reservedMem: 1024,
    });

    const getRes = await scf.concurrency.getReserved({
      functionName: inputs.name,
      namespace: inputs.namespace,
    });
    expect(getRes.reservedMem).toEqual(1024);
  });

  test('Update funciton version to 1', async () => {
    const res = await scf.version.publish({
      functionName: inputs.name,
      namespace: inputs.namespace,
    });
    console.log(res);
  });

  test('Provision function concurrency', async () => {
    await scf.scf.wait({
      functionName: inputs.name,
      namespace: inputs.namespace,
      qualifier: '1',
    });

    await scf.concurrency.waitProvisioned({
      functionName: inputs.name,
      namespace: inputs.namespace,
    });

    const res = await scf.concurrency.setProvisioned({
      functionName: inputs.name,
      namespace: inputs.namespace,
      provisionedNum: 10,
      qualifier: '1',
    });

    const getRes = await scf.concurrency.getProvisioned({
      functionName: inputs.name,
      namespace: inputs.namespace,
    });

    expect(getRes.allocated[0].allocatedNum).toEqual(10);
    expect(getRes.allocated[0].qualifier).toEqual('1');

    console.log(res);
  });

  test('Update funciton version to 2', async () => {
    const res = await scf.version.publish({
      functionName: inputs.name,
      namespace: inputs.namespace,
    });
    console.log(res);
  });

  test('Update Provision function concurrency', async () => {
    await scf.scf.wait({
      functionName: inputs.name,
      namespace: inputs.namespace,
      qualifier: '2',
    });

    await scf.concurrency.waitProvisioned({
      functionName: inputs.name,
      namespace: inputs.namespace,
    });

    const res = await scf.concurrency.setProvisioned({
      functionName: inputs.name,
      namespace: inputs.namespace,
      provisionedNum: 10,
      qualifier: '2',
      lastQualifier: '1',
    });

    const getRes = await scf.concurrency.getProvisioned({
      functionName: inputs.name,
      namespace: inputs.namespace,
    });

    expect(getRes.allocated[0].allocatedNum).toEqual(10);
    expect(getRes.allocated[0].qualifier).toEqual('2');

    console.log(res);
  });

  test('Remove function', async () => {
    await scf.remove({
      functionName: inputs.name,
      namespace: inputs.namespace,
    });
  });
});
