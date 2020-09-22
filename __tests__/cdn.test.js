const { Cdn } = require('../src');
const { getCdnByDomain } = require('../src/modules/cdn/utils');

describe('Cdn', () => {
  jest.setTimeout(600000);
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const inputs = {
    async: false,
    area: 'overseas',
    domain: 'test.yuga.chat',
    origin: {
      origins: ['up6pwd9-89hm718-xxx.cos-website.ap-guangzhou.myqcloud.com'],
      originType: 'cos',
      originPullProtocol: 'https',
    },
    serviceType: 'web',
    https: {
      switch: 'on',
      http2: 'on',
      certInfo: {
        certId: 'cWOJJjax',
      },
    },
    forceRedirect: {
      switch: 'on',
      redirectType: 'https',
      redirectStatusCode: 301,
    },
  };
  const cdn = new Cdn(credentials, process.env.REGION);

  test('should deploy CDN success with originType = cos', async () => {
    const res = await cdn.deploy(inputs);
    expect(res).toEqual({
      https: true,
      domain: inputs.domain,
      origins: inputs.origin.origins,
      cname: `${inputs.domain}.cdn.dnsv1.com`,
      inputCache: JSON.stringify(inputs),
      resourceId: expect.stringContaining('cdn-'),
    });
  });


  test('should deploy CDN success with originType = domain', async () => {
    inputs.origin.originType = 'domain';
    const res = await cdn.deploy(inputs);
    expect(res).toEqual({
      https: true,
      domain: inputs.domain,
      origins: inputs.origin.origins,
      cname: `${inputs.domain}.cdn.dnsv1.com`,
      inputCache: JSON.stringify(inputs),
      resourceId: expect.stringContaining('cdn-'),
    });
  });

  test('should remove CDN success', async () => {
    const res = await cdn.remove(inputs);
    expect(res).toEqual({});
    const detail = await getCdnByDomain(cdn.capi, inputs.domain);
    expect(detail).toBeUndefined();
  });
});

