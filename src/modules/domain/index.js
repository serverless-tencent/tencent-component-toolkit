const { domain } = require('tencent-cloud-sdk');
class Domain {
  constructor(credentials = {}, region = 'ap-guangzhou') {
    this.credentials = credentials;
    this.region = region;
    this.domainClient = new domain(this.credentials);
  }

  async check(domainStr) {
    let domainData;
    const domainStrList = domainStr.split('.');
    for (let i = 0; i < domainStrList.length; i++) {
      const domainResult = await this.domainClient.request({
        Action: 'CheckDomain',
        Version: '2018-08-08',
        Region: this.region,
        DomainName: domainStrList.slice(i).join('.'),
      });
      if (!domainResult.Response.Error) {
        domainData = domainResult.Response.DomainName;
        break;
      }
    }

    return {
      domain: domainData,
      subDomain: domainStr
        .split(domainData)
        .slice(0, -1)
        .join(domainData)
        .slice(0, -1),
    };
  }
}

module.exports = Domain;
