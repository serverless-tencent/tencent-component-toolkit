const { Cos } = require('../src');
const path = require('path');
const request = require('request-promise-native');
const { sleep } = require('@ygkit/request');

describe('Cos', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const bucket = `serverless-cos-test-${process.env.TENCENT_APP_ID}`;
  const staticPath = path.join(__dirname, 'static');
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
    },
    bucket: bucket,
    src: staticPath,
    force: true,
    protocol: 'https',
    replace: true,
  };
  const cos = new Cos(credentials, process.env.REGION);

  test('should deploy Cos success', async () => {
    const res = await cos.deploy(inputs);
    await sleep(1000);
    const reqUrl = `https://${bucket}.cos.${process.env.REGION}.myqcloud.com/index.html`;
    const content = await request.get(reqUrl);
    expect(res).toEqual(inputs);
    expect(content).toMatch(/Serverless\sFramework/gi);
  });

  test('should deploy website success', async () => {
    const res = await cos.website(websiteInputs);
    await sleep(1000);
    const websiteUrl = `${inputs.bucket}.cos-website.${process.env.REGION}.myqcloud.com`;
    const reqUrl = `${websiteInputs.protocol}://${websiteUrl}`;
    const content = await request.get(reqUrl);
    expect(res).toBe(websiteUrl);
    expect(content).toMatch(/Serverless\sFramework/gi);
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
