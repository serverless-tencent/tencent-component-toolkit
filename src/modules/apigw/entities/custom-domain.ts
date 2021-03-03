import { Capi } from '@tencent-sdk/capi';
import {
  ApigwCustomDomain,
  ApigwBindCustomDomainInputs,
  ApigwBindCustomDomainOutputs,
} from '../interface';
import { pascalCaseProps, deepEqual } from '../../../utils';
import APIS, { ActionType } from '../apis';
import { getProtocolString } from '../utils';

interface FormattedApigwCustomDomain {
  domain: string;
  protocols: string;

  certificateId?: string;
  isDefaultMapping: boolean;
  pathMappingSetDict: Record<string, string>;
  netType: string;
  isForcedHttps: boolean;
}

function getCustomDomainFormattedDict(domains: ApigwCustomDomain[]) {
  const domainDict: Record<string, FormattedApigwCustomDomain> = {};
  domains.forEach((d) => {
    const pmDict: Record<string, string> = {};
    for (const pm of d.pathMappingSet ?? []) {
      pmDict[pm.path] = pm.environment;
    }
    domainDict[d.domain] = {
      domain: d.domain,
      certificateId: d.certificateId ?? '',
      protocols: getProtocolString(d.protocols ?? ''),
      isDefaultMapping: d.isDefaultMapping === false ? false : true,
      pathMappingSetDict: pmDict,
      netType: d.netType ?? 'OUTER',
      isForcedHttps: d.isForcedHttps === true,
    };
  });

  return domainDict;
}

export default class CustomDomainEntity {
  capi: Capi;

  constructor(capi: Capi) {
    this.capi = capi;
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, pascalCaseProps(data));
    return result as never;
  }

  async getCurrentDict(serviceId: string) {
    const res = (await this.request({
      Action: 'DescribeServiceSubDomains',
      ServiceId: serviceId,
    })) as
      | {
          DomainSet?: {
            /**
             * 域名名称。
             */
            DomainName: string;
            /**
             * 域名解析状态。True 表示正常解析，False 表示解析失败。
             */
            Status: number;
            /**
             * 证书ID。
             */
            CertificateId: string;
            /**
             * 是否使用默认路径映射。
             */
            IsDefaultMapping: boolean;
            /**
             * 自定义域名协议类型。
             */
            Protocol: string;
            /**
             * 网络类型（'INNER' 或 'OUTER'）。
             */
            NetType: string;
            IsForcedHttps: boolean;
          }[];
        }
      | undefined;

    const domainDict: Record<string, FormattedApigwCustomDomain> = {};

    for (const d of res?.DomainSet ?? []) {
      const domain: FormattedApigwCustomDomain = {
        domain: d.DomainName,
        protocols: d.Protocol,
        certificateId: d.CertificateId,
        isDefaultMapping: d.IsDefaultMapping,
        isForcedHttps: d.IsForcedHttps,
        netType: d.NetType,
        pathMappingSetDict: {},
      };

      const mappings = (await this.request({
        Action: 'DescribeServiceSubDomainMappings',
        ServiceId: serviceId,
        SubDomain: d.DomainName,
      })) as {
        IsDefaultMapping?: boolean;
        PathMappingSet?: {
          Path: string;
          Environment: string;
        }[];
      };

      mappings?.PathMappingSet?.map((v) => {
        domain.pathMappingSetDict[v.Path] = v.Environment;
      });

      domainDict[domain.domain] = domain;
    }

    return domainDict;
  }

  /**
   * 解绑 API 网关所有自定义域名，不解绑当前已有并且需要配置的域名
   * @param serviceId API 网关 ID
   */
  async unbind(
    serviceId: string,
    oldCustomDomains: ApigwCustomDomain[],
    currentDict: Record<string, FormattedApigwCustomDomain> = {},
    newDict: Record<string, FormattedApigwCustomDomain> = {},
  ) {
    const domains = Object.keys(currentDict);

    if (domains.length > 0) {
      // 解绑所有创建的自定义域名
      for (let i = 0; i < domains.length; i++) {
        const domain = domains[i];
        // 当前绑定状态与新的绑定状态一致，不解绑
        if (deepEqual(currentDict[domain], newDict[domain])) {
          console.log(`Domain ${domain} for service ${serviceId} unchanged, won't unbind`);
          continue;
        }

        for (let j = 0; j < oldCustomDomains.length; j++) {
          // 只解绑由组件创建的域名
          if (oldCustomDomains[j].subDomain === domain) {
            console.log(`Start unbind domain ${domain} for service ${serviceId}`);
            await this.request({
              Action: 'UnBindSubDomain',
              serviceId,
              subDomain: domain,
            });
          }
        }
      }
    }
  }

  /**
   * 为 API 网关服务绑定自定义域名
   */
  async bind({
    serviceId,
    subDomain,
    inputs,
  }: {
    serviceId: string;
    subDomain: string;
    inputs: ApigwBindCustomDomainInputs;
  }): Promise<ApigwBindCustomDomainOutputs[]> {
    const { customDomains = [] } = inputs;
    const { oldState = {} } = inputs;

    const currentDict = await this.getCurrentDict(serviceId);

    const newDict = getCustomDomainFormattedDict(customDomains);

    // 1. 解绑旧的自定义域名
    await this.unbind(serviceId, oldState?.customDomains ?? [], currentDict, newDict);

    // 2. bind user config domain
    const customDomainOutput: ApigwBindCustomDomainOutputs[] = [];
    if (customDomains && customDomains.length > 0) {
      console.log(`Start bind custom domain for service ${serviceId}`);
      for (let i = 0; i < customDomains.length; i++) {
        const domainItem = customDomains[i];
        const domainProtocol = domainItem.protocols
          ? getProtocolString(domainItem.protocols)
          : inputs.protocols;
        const domainInputs = {
          serviceId,
          subDomain: domainItem.domain,
          netSubDomain: subDomain,
          certificateId: domainItem.certificateId,
          // default isDefaultMapping is true
          isDefaultMapping: domainItem.isDefaultMapping === false ? false : true,
          // if isDefaultMapping is false, should append pathMappingSet config
          pathMappingSet: domainItem.pathMappingSet || [],
          netType: domainItem.netType ?? 'OUTER',
          protocol: domainProtocol,
          isForcedHttps: domainItem.isForcedHttps === true,
        };

        try {
          const { domain } = domainItem;
          // 当前状态与新的状态一致，不进行绑定
          if (currentDict[domain] && deepEqual(currentDict[domain], newDict[domain])) {
            console.log(`Custom domain for service ${serviceId} unchanged, wont create`);
            console.log(`Please add CNAME record ${subDomain} for ${domainItem.domain}`);
          } else {
            await this.request({
              Action: 'BindSubDomain',
              ...domainInputs,
            });
            console.log(`Custom domain for service ${serviceId} created success`);
            console.log(`Please add CNAME record ${subDomain} for ${domainItem.domain}`);
          }

          customDomainOutput.push({
            isBinded: true,
            created: true,
            subDomain: domainItem.domain,
            cname: subDomain,
            url: `${domainProtocol.indexOf('https') !== -1 ? 'https' : 'http'}://${
              domainItem.domain
            }`,
          });
        } catch (e) {
          // User hasn't add cname dns record
          if (e.code === 'FailedOperation.DomainResolveError') {
            customDomainOutput.push({
              isBinded: false,
              subDomain: domainItem.domain,
              cname: subDomain,
              message: `您的自定义域名还未生效，请给域名 ${domainItem.domain} 添加 CNAME 记录 ${subDomain}，等待解析生效后，再次运行 'sls deploy' 完成自定义域名的配置`,
            });
          } else {
            throw e;
          }
        }
      }
    }

    return customDomainOutput;
  }
}
