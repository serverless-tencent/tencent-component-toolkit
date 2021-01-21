import { ActionType } from './apis';
import { ApiServiceType } from './../interface';
import { Capi } from '@tencent-sdk/capi';
import { RegionType, CapiCredentials } from '../interface';
import APIS from './apis';

class Domain {
  region: RegionType;
  credentials: CapiCredentials;
  capi: Capi;

  constructor(credentials = {}, region:RegionType = 'ap-guangzhou') {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.domain,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });
  }

  async request({ Action, ...data }:{Action:ActionType, [key:string]:any}) {
    const result = await APIS[Action](this.capi, data);
    return result;
  }

  /** 检查域名 */
  async check(domainStr: string) {
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

export default Domain;
