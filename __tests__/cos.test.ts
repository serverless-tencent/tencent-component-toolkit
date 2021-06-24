import { convertCosError } from './../src/modules/cos/index';
import { CosDeployInputs, CosWebsiteInputs } from './../src/modules/cos/interface';
import { Cos } from '../src';
import path from 'path';
import axios from 'axios';
import { sleep } from '@ygkit/request';

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
  const inputs: CosDeployInputs = {
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

  const websiteInputs: CosWebsiteInputs = {
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
    ignoreHtmlExt: false,
    acl: {
      permissions: 'public-read',
    },
  };
  const cos = new Cos(credentials, process.env.REGION);

  test('deploy cos fail', async () => {
    try {
      const res = await cos.deploy({ ...inputs, bucket: '1234567890' });
      expect(res).toBe(undefined);
    } catch (err) {
      expect(err.type).toBe('API_COS_putBucket');
      expect(err.displayMsg).toBe('Bucket should format as "test-1250000000".');
    }
  });

  test('convert error correct', async () => {
    expect(
      convertCosError({
        code: 'error',
        message: 'message',
        headers: {
          'x-cos-request-id': '123',
        },
        error: undefined,
      }).message,
    ).toBe('message (reqId: 123)');

    expect(
      convertCosError({
        code: 'error',
        message: 'error_message',
        error: 'message',
      }).message,
    ).toBe('error_message');

    expect(
      convertCosError({
        code: 'error',
        message: 'error_message',
        headers: {
          'x-cos-request-id': '123',
        },
        error: {
          Code: 'error',
          Message: 'message',
        },
      }).message,
    ).toBe('message (reqId: 123)');
  });

  test('should deploy cos', async () => {
    const res = await cos.deploy(inputs);
    await sleep(1000);
    const reqUrl = `https://${bucket}.cos.${process.env.REGION}.myqcloud.com/index.html`;
    const { data } = await axios.get(reqUrl);
    expect(res).toEqual(inputs);
    expect(data).toMatch(/Serverless/gi);
  });

  test('deploy cos again (update)', async () => {
    const res = await cos.deploy(inputs);
    await sleep(1000);
    const reqUrl = `https://${bucket}.cos.${process.env.REGION}.myqcloud.com/index.html`;
    const { data } = await axios.get(reqUrl);
    expect(res).toEqual(inputs);
    expect(data).toMatch(/Serverless/gi);
  });

  test('getObjectUrl', async () => {
    const res = await cos.getObjectUrl({
      bucket,
      object: 'index.html',
      method: 'GET',
    });

    expect(res).toMatch(/http/);
  });

  test('[website - default] deploy website', async () => {
    const res = await cos.website(websiteInputs);

    await sleep(2000);
    const websiteUrl = `${inputs.bucket}.cos-website.${process.env.REGION}.myqcloud.com`;
    const reqUrl = `${websiteInputs.protocol}://${websiteUrl}`;
    const { data } = await axios.get(reqUrl);
    try {
      await axios.get(`${reqUrl}/error.html`);
    } catch (e) {
      expect(e.response.status).toBe(404);
      expect(e.response.data).toMatch(/Serverless/gi);
    }
    expect(res).toBe(websiteUrl);
    expect(data).toMatch(/Serverless/gi);
  });

  test('[website - ignoreHtmlExt] deploy website', async () => {
    websiteInputs.ignoreHtmlExt = true;
    const res = await cos.website(websiteInputs);

    await sleep(1000);
    const websiteUrl = `${inputs.bucket}.cos-website.${process.env.REGION}.myqcloud.com`;
    const reqUrl = `${websiteInputs.protocol}://${websiteUrl}/test`;
    const { data } = await axios.get(reqUrl);
    expect(res).toBe(websiteUrl);
    expect(data).toMatch(/Serverless/gi);
    expect(data).toMatch(/Test/gi);
  });

  test('[website - disableErrorStatus] deploy website and error code with 200', async () => {
    websiteInputs.disableErrorStatus = true;

    const res = await cos.website(websiteInputs);

    await sleep(1000);
    const websiteUrl = `${inputs.bucket}.cos-website.${process.env.REGION}.myqcloud.com`;
    const reqUrl = `${websiteInputs.protocol}://${websiteUrl}`;
    const { data, status } = await axios.get(`${reqUrl}/error.html`);
    expect(res).toBe(websiteUrl);
    expect(data).toMatch(/Serverless/gi);
    expect(status).toBe(200);
  });

  test('[cos - policy] deploy Cos success with policy', async () => {
    inputs.acl.permissions = 'private';
    inputs.policy = policy;
    const res = await cos.deploy(inputs);
    await sleep(1000);
    const reqUrl = `https://${bucket}.cos.${process.env.REGION}.myqcloud.com/index.html`;
    const { data } = await axios.get(reqUrl);
    expect(res).toEqual(inputs);
    expect(data).toMatch(/Serverless/gi);
  });

  test('[website - policy] deploy website success with policy', async () => {
    websiteInputs.acl.permissions = 'private';
    websiteInputs.policy = policy;
    const res = await cos.website(websiteInputs);
    await sleep(1000);
    const websiteUrl = `${inputs.bucket}.cos-website.${process.env.REGION}.myqcloud.com`;
    const reqUrl = `${websiteInputs.protocol}://${websiteUrl}`;
    const { data } = await axios.get(reqUrl);
    expect(res).toBe(websiteUrl);
    expect(data).toMatch(/Serverless/gi);
  });

  test('remove success', async () => {
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
