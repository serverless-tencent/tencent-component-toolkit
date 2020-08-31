const { Capi } = require('@tencent-sdk/capi');
const Apis = require('./apis');

class Domain {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      AppId: this.credentials.AppId,
      SecretId: this.credentials.SecretId,
      SecretKey: this.credentials.SecretKey,
      Token: this.credentials.Token,
    });
  }

  async request({ Action, ...data }) {
    const result = await Apis[Action](this.capi, data);
    return result;
  }

  async check(domainStr) {
    let domainData;
    const domainStrList = domainStr.split('.');
    for (let i = 0; i < domainStrList.length; i++) {
      try {
        const { DomainName } = await this.request({
          Action: 'CheckDomain',
          DomainName: domainStrList.slice(i).join('.'),
        });
        domainData = DomainName;
        break;
      } catch (e) {}
    }

    if (domainData) {
      return {
        domain: domainData,
        subDomain: domainStr
          .split(domainData)
          .slice(0, -1)
          .join(domainData)
          .slice(0, -1),
      };
    }
    return undefined;
  }
}

module.exports = Domain;
