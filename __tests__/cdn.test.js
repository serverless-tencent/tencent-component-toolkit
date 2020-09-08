const { Cdn } = require('../src');

describe('Cdn', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const inputs = {
    async: true,
    area: 'overseas',
    domain: 'test.yuga.chat',
    hostType: 'cos',
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

  test('should deploy CDN success', async () => {
    const res = await cdn.deploy(inputs);
    expect(res).toEqual({
      created: true,
      https: true,
      domain: inputs.domain,
      origins: inputs.origin.origins,
      cname: `${inputs.domain}.cdn.dnsv1.com`,
      inputCache: JSON.stringify(inputs),
      resourceId: expect.stringContaining('cdn-'),
    });
  });
});

