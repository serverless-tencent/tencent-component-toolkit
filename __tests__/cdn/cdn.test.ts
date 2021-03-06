import { CdnDeployInputs } from '../../src/modules/cdn/interface';
import { Cdn } from '../../src';
import { getCdnByDomain, openCdnService } from '../../src/modules/cdn/utils';
import { sleep } from '@ygkit/request';

describe('Cdn', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const tags = [
    {
      key: 'slstest',
      value: 'slstest',
    },
  ];
  const inputs: CdnDeployInputs = {
    async: false,
    area: 'overseas',
    domain: process.env.SUB_DOMAIN,
    origin: {
      origins: [
        `${process.env.BUCKET}-${process.env.TENCENT_APP_ID}.cos.${process.env.REGION}.myqcloud.com`,
      ],
      originType: 'cos',
      originPullProtocol: 'https',
    },
    serviceType: 'web',
    https: {
      switch: 'on',
      http2: 'on',
      certInfo: {
        certId: process.env.SUB_DOMAIN_CERT_ID,
      },
    },
    forceRedirect: {
      switch: 'on',
      redirectType: 'https',
      redirectStatusCode: 301,
    },
    tags,
  };
  const cdn = new Cdn(credentials);

  test('openCdnService', async () => {
    await openCdnService(cdn.capi);

    expect(true).toEqual(true);
  });

  test('should deploy CDN success with originType = cos', async () => {
    await sleep(5000);
    const res = await cdn.deploy(inputs);
    expect(res).toEqual({
      https: true,
      domain: inputs.domain,
      origins: inputs.origin.origins,
      cname: `${inputs.domain}.cdn.dnsv1.com`,
      inputCache: JSON.stringify(inputs),
      resourceId: expect.stringContaining('cdn-'),
      tags,
    });
  });

  test('should deploy CDN success with originType = domain', async () => {
    await sleep(5000);
    inputs.origin.originType = 'domain';
    const res = await cdn.deploy(inputs);
    expect(res).toEqual({
      https: true,
      domain: inputs.domain,
      origins: inputs.origin.origins,
      cname: `${inputs.domain}.cdn.dnsv1.com`,
      inputCache: JSON.stringify(inputs),
      resourceId: expect.stringContaining('cdn-'),
      tags,
    });
  });

  test('should remove CDN success', async () => {
    const res = await cdn.remove(inputs);
    expect(res).toEqual({});
    const detail = await getCdnByDomain(cdn.capi, inputs.domain);
    expect(detail).toBeUndefined();
  });
});
