const { Cns } = require('../lib');

describe('Cns', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const inputs = {
    domain: process.env.DOMAIN,
    records: [
      {
        subDomain: ['abc', 'cde'],
        recordType: 'CNAME',
        recordLine: ['移动'],
        value: 'cname1.dnspod.com',
        ttl: 600,
        mx: 10,
        status: 'enable',
      },
      {
        subDomain: 'xyz',
        recordType: 'CNAME',
        recordLine: '默认',
        value: 'cname2.dnspod.com',
        ttl: 600,
        mx: 10,
        status: 'enable',
      },
    ],
  };
  const cns = new Cns(credentials, process.env.REGION);

  let recordList;
  test('should deploy Cns success', async () => {
    recordList = await cns.deploy(inputs);
    expect(recordList).toEqual({
      records: [
        {
          subDomain: 'abc',
          recordType: 'CNAME',
          recordLine: '移动',
          recordId: expect.anything(),
          value: 'cname1.dnspod.com.',
          status: 'enable',
          domain: inputs.domain,
        },
        {
          subDomain: 'cde',
          recordType: 'CNAME',
          recordLine: '移动',
          recordId: expect.anything(),
          value: 'cname1.dnspod.com.',
          status: 'enable',
          domain: inputs.domain,
        },
        {
          subDomain: 'xyz',
          recordType: 'CNAME',
          recordLine: '默认',
          recordId: expect.anything(),
          value: 'cname2.dnspod.com.',
          status: 'enable',
          domain: inputs.domain,
        },
      ],
    });
  });

  test('should remove Cns success', async () => {
    const res = await cns.remove(recordList);
    expect(res).toEqual(true);
  });
});
