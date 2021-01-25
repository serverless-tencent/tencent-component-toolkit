const { Cos } = require('../lib');
const path = require('path');
const axios = require('axios');
const { sleep } = require('@ygkit/request');

describe('Cos', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const bucket = `serverless-cos-test-${process.env.TENCENT_APP_ID}`;
  const staticPath = path.join(__dirname, 'static');
  const policy = {
    Statement: [
      {
        Principal: { qcs: ['qcs::cam::anyone:anyone'] },
        Effect: 'Allow',
        Action: [
          'name/cos:HeadBucket',
          'name/cos:ListMultipartUploads',
          'name/cos:ListParts',
          'name/cos:GetObject',
          'name/cos:HeadObject',
          'name/cos:OptionsObject',
        ],
        Resource: [`qcs::cos:${process.env.REGION}:uid/${process.env.TENCENT_APP_ID}:${bucket}/*`],
      },
    ],
    version: '2.0',
  };
  const inputs = {
    bucket: bucket,
    src: staticPath,
    force: true,
    acl: {
      permissions: 'public-read',
    },
    tags: [
      {
        key: 'test',
        value: 'abcd',
      },
    ],
    rules: [
      {
        status: 'Enabled',
        id: 'deleteObject',
        filter: '',
        expiration: { days: '10' },
        abortIncompleteMultipartUpload: { daysAfterInitiation: '10' },
      },
    ],
  };

  const websiteInputs = {
    code: {
      src: staticPath,
      index: 'index.html',
      error: 'index.html',
    },
    bucket: bucket,
    src: staticPath,
    force: true,
    protocol: 'https',
    replace: true,
    acl: {
      permissions: 'public-read',
    },
  };
  const cos = new Cos(credentials, process.env.REGION);

  test('should deploy Cos success', async () => {
    const res = await cos.deploy(inputs);
    await sleep(1000);
    const reqUrl = `https://${bucket}.cos.${process.env.REGION}.myqcloud.com/index.html`;
    const { data } = await axios.get(reqUrl);
    expect(res).toEqual(inputs);
    expect(data).toMatch(/Serverless\sFramework/gi);
  });

  test('should deploy website success', async () => {
    const res = await cos.website(websiteInputs);

    await sleep(2000);
    const websiteUrl = `${inputs.bucket}.cos-website.${process.env.REGION}.myqcloud.com`;
    const reqUrl = `${websiteInputs.protocol}://${websiteUrl}`;
    const { data } = await axios.get(reqUrl);
    try {
      await axios.get(`${reqUrl}/error.html`);
    } catch (e) {
      expect(e.response.status).toBe(404);
      expect(e.response.data).toMatch(/Serverless\sFramework/gi);
    }
    expect(res).toBe(websiteUrl);
    expect(data).toMatch(/Serverless\sFramework/gi);
  });

  test('should deploy website and error code with 200', async () => {
    websiteInputs.disableErrorStatus = true;

    const res = await cos.website(websiteInputs);

    await sleep(1000);
    const websiteUrl = `${inputs.bucket}.cos-website.${process.env.REGION}.myqcloud.com`;
    const reqUrl = `${websiteInputs.protocol}://${websiteUrl}`;
    const { data, status } = await axios.get(`${reqUrl}/error.html`);
    expect(res).toBe(websiteUrl);
    expect(data).toMatch(/Serverless\sFramework/gi);
    expect(status).toBe(200);
  });

  test('should deploy Cos success with policy', async () => {
    inputs.acl.permissions = 'private';
    inputs.policy = policy;
    const res = await cos.deploy(inputs);
    await sleep(1000);
    const reqUrl = `https://${bucket}.cos.${process.env.REGION}.myqcloud.com/index.html`;
    const { data } = await axios.get(reqUrl);
    expect(res).toEqual(inputs);
    expect(data).toMatch(/Serverless\sFramework/gi);
  });

  test('should deploy website success with policy', async () => {
    websiteInputs.acl.permissions = 'private';
    websiteInputs.policy = policy;
    const res = await cos.website(websiteInputs);
    await sleep(1000);
    const websiteUrl = `${inputs.bucket}.cos-website.${process.env.REGION}.myqcloud.com`;
    const reqUrl = `${websiteInputs.protocol}://${websiteUrl}`;
    const { data } = await axios.get(reqUrl);
    expect(res).toBe(websiteUrl);
    expect(data).toMatch(/Serverless\sFramework/gi);
  });

  test('should remove Cos success', async () => {
    await cos.remove(inputs);
    try {
      await cos.getBucket({
        bucket: bucket,
      });
    } catch (e) {
      expect(e.code).toBe('NoSuchBucket');
    }
  });
});
