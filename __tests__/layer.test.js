const { sleep } = require('@ygkit/request');
const { Layer } = require('../src');

describe('Layer', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const layer = new Layer(credentials, process.env.REGION);

  const inputs = {
    region: 'ap-guangzhou',
    name: 'layer-test',
    bucket: process.env.BUCKET,
    object: 'node_modules.zip',
    description: 'Layer created by Serverless Component',
    runtimes: ['Nodejs10.15', 'Nodejs12.16'],
  };

  test('should deploy layer success', async () => {
    const res = await layer.deploy(inputs);
    expect(res).toEqual({
      region: process.env.REGION,
      name: inputs.name,
      bucket: inputs.bucket,
      object: inputs.object,
      description: inputs.description,
      runtimes: inputs.runtimes,
      version: expect.any(Number),
    });

    inputs.version = res.version;
  });

  test('should remove layer success', async () => {
    await sleep(1000);
    await layer.remove({
      name: inputs.name,
      version: inputs.version,
    });

    const detail = await layer.getLayerDetail(inputs.name, inputs.version);
    expect(detail).toBeNull();
  });
});
