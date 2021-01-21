import { ApiServiceType } from './../interface';
import { Capi } from '@tencent-sdk/capi';
import { sleep, waitResponse } from '@ygkit/request';
import { pascalCaseProps, deepClone } from '../../utils';
import { ApiTypeError } from '../../utils/error';
import { CapiCredentials } from '../interface';
import APIS from './apis';
import { DeployInputs } from './interface';
import {
  TIMEOUT,
  formatCertInfo,
  formatOrigin,
  getCdnByDomain,
  openCdnService,
} from './utils';


export default class Cdn {
  credentials: CapiCredentials;
  capi: Capi;

  constructor(credentials: CapiCredentials = {} as any) {
    this.credentials = credentials;

    this.capi = new Capi({
      Region: 'ap-guangzhou',
      ServiceType: ApiServiceType.cdn,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });
  }

  async purgeCdnUrls(urls: string[], flushType = 'flush') {
    console.log(`Purging CDN caches, it will work in 5 minutes...`);
    try {
      await APIS.PurgePathCache(this.capi, {
        Paths: urls,
        FlushType: flushType,
      });
    } catch (e) {
      // no op
    }
  }

  async pushCdnUrls(urls: string[], userAgent = 'flush', area = 'mainland') {
    console.log(`Pushing CDN caches...`);
    try {
      await APIS.PushUrlsCache(this.capi, {
        Urls: urls,
        Area: area,
        UserAgent: userAgent,
      });
    } catch (e) {
      // no op
    }
  }

  async offlineCdnDomain(domain: string) {
    const { Status } = await getCdnByDomain(this.capi, domain);
    if (Status === 'online') {
      // disable first
      await APIS.StopCdnDomain(this.capi, { Domain: domain });
    } else if (Status === 'processing') {
      throw new Error(`Status is not operational for ${domain}`);
    }
  }

  /** 部署 CDN */
  async deploy(inputs : DeployInputs) {
    
    await openCdnService(this.capi);
    const { oldState = {} } = inputs;
    delete inputs.oldState;
    const pascalInputs = pascalCaseProps(inputs);

    // only refresh cdn
    if (pascalInputs.OnlyRefresh === true) {
      const domainExist = await getCdnByDomain(this.capi, pascalInputs.Domain);
      // refresh cdn urls
      if (domainExist && pascalInputs.RefreshCdn?.Urls) {
        await this.purgeCdnUrls(pascalInputs.RefreshCdn.Urls, pascalInputs.RefreshCdn.FlushType);
      }
      return {
        resourceId: domainExist.ResourceId,
        https: !!pascalInputs.Https,
        domain: pascalInputs.Domain,
        origins: pascalInputs.Origin && pascalInputs.Origin.Origins,
        cname: `${pascalInputs.Domain}.cdn.dnsv1.com`,
        refreshUrls: pascalInputs.RefreshCdn?.Urls,
      };
    }

    const cdnInputs = deepClone({
      ...pascalInputs,
      Origin: formatOrigin(pascalInputs.Origin),
    });


    const outputs = {
      https: !!pascalInputs.Https,
      domain: pascalInputs.Domain,
      origins: cdnInputs.Origin.Origins,
      cname: `${pascalInputs.Domain}.cdn.dnsv1.com`,
      inputCache: JSON.stringify(inputs),
      resourceId: "",
    };

    if (pascalInputs.Https) {
      cdnInputs.Https = {
        Switch: pascalInputs.Https.Switch ?? 'on',
        Http2: pascalInputs.Https.Http2 ?? 'off',
        OcspStapling: pascalInputs.Https.OcspStapling || 'off',
        VerifyClient: pascalInputs.Https.VerifyClient || 'off',
        CertInfo: formatCertInfo(pascalInputs.Https.CertInfo),
      };
    }
    if (pascalInputs.ForceRedirect && pascalInputs.Https) {
      cdnInputs.ForceRedirect = {
        Switch: pascalInputs.ForceRedirect.Switch ?? 'on',
        RedirectStatusCode: pascalInputs.ForceRedirect.RedirectStatusCode || 301,
        RedirectType: 'https',
      };
    }

    let cdnInfo = await getCdnByDomain(this.capi, pascalInputs.Domain);

    const sourceInputs = JSON.parse(JSON.stringify(cdnInputs));

    const createOrUpdateCdn = async () => {
      if (cdnInfo && cdnInfo.Status === 'offline') {
        console.log(`The CDN domain ${pascalInputs.Domain} is offline.`);
        console.log(`Recreating CDN domain ${pascalInputs.Domain}`);
        await APIS.DeleteCdnDomain(this.capi, { Domain: pascalInputs.Domain });
        cdnInfo = null;
      }
      if (cdnInfo) {
        // update
        console.log(`The CDN domain ${pascalInputs.Domain} has existed.`);
        console.log('Updating...');
        // TODO: when update, VIP user can not set ServiceType parameter, need CDN api optimize
        if (cdnInputs.ServiceType && cdnInputs.ServiceType !== cdnInfo.ServiceType) {
          cdnInputs.ServiceType = inputs.serviceType;
        }
        await APIS.UpdateDomainConfig(this.capi, cdnInputs);
        outputs.resourceId = cdnInfo.ResourceId;
      } else {
        // create
        console.log(`Adding CDN domain ${pascalInputs.Domain}...`);
        try {
          // if not config ServiceType, default to web
          cdnInputs.ServiceType = inputs.serviceType ?? 'web';
          await APIS.AddCdnDomain(this.capi, cdnInputs);
        } catch (e) {
          if (e.code === 'ResourceNotFound.CdnUserNotExists') {
            console.log(`Please goto https://console.cloud.tencent.com/cdn open CDN service.`);
          }
          throw e;
        }
        await sleep(1000);
        const detail = await getCdnByDomain(this.capi, pascalInputs.Domain);

        outputs.resourceId = detail && detail.ResourceId;
      }

      console.log('Waiting for CDN deploy success, it maybe cost 5 minutes....');
      // When set syncFlow false, just continue, do not wait for online status.
      if (pascalInputs.Async === false) {
        await waitResponse({
          callback: async () => getCdnByDomain(this.capi, pascalInputs.Domain),
          targetProp: 'Status',
          targetResponse: 'online',
          timeout: TIMEOUT,
        });

        // push cdn urls
        if (pascalInputs.PushCdn && pascalInputs.PushCdn.Urls) {
          await this.pushCdnUrls(pascalInputs.PushCdn.Urls, pascalInputs.PushCdn.Area, pascalInputs.PushCdn.UserAgent);
        }

        // refresh cdn urls
        if (pascalInputs.RefreshCdn && pascalInputs.RefreshCdn.Urls) {
          await this.purgeCdnUrls(pascalInputs.RefreshCdn.Urls);
        }
      }
      console.log(`CDN deploy success to domain: ${pascalInputs.Domain}`);
    };

    // pass state for cache check
    const { inputCache } = oldState;
    if (inputCache && inputCache === JSON.stringify(sourceInputs)) {
      console.log(`No configuration changes for CDN domain ${pascalInputs.Domain}`);
      outputs.resourceId = cdnInfo.ResourceId;
    } else {
      await createOrUpdateCdn();
    }

    return outputs;
  }

  /** 删除 CDN */
  async remove(inputs: {domain: string}) {
    const { domain } = inputs;
    if (!domain) {
      throw new ApiTypeError(`PARAMETER_CDN`, 'domain is required');
    }

    // need circle for deleting, after domain status is 6, then we can delete it
    console.log(`Start removing CDN for ${domain}`);
    const detail = await getCdnByDomain(this.capi, domain);
    if (!detail) {
      console.log(`CDN domain ${domain} not exist`);
      return {};
    }

    const { Status } = detail;

    if (Status === 'online') {
      // disable first
      await APIS.StopCdnDomain(this.capi, { Domain: domain });
    } else if (Status === 'processing') {
      console.log(`Status is not operational for ${domain}`);
      return {};
    }
    console.log(`Waiting for offline ${domain}...`);
    await waitResponse({
      callback: async () => getCdnByDomain(this.capi, domain),
      targetProp: 'Status',
      targetResponse: 'offline',
      timeout: TIMEOUT,
    });
    console.log(`Removing CDN for ${domain}`);
    await APIS.DeleteCdnDomain(this.capi, { Domain: domain });
    console.log(`Removed CDN for ${domain}.`);
    return {};
  }
}
