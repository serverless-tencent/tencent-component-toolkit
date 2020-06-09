const { Capi } = require('@tencent-sdk/capi');
const { sleep, waitResponse } = require('@ygkit/request');
const { TypeError } = require('../../utils/error');
const {
  AddCdnDomain,
  UpdateDomainConfig,
  StopCdnDomain,
  DeleteCdnDomain,
  PurgePathCache,
  PushUrlsCache,
} = require('./apis');
const {
  TIMEOUT,
  formatCertInfo,
  formatOrigin,
  camelCaseProperty,
  getCdnByDomain,
  flushEmptyValue,
} = require('./utils');

class Cdn {
  constructor(credentials = {}) {
    this.credentials = credentials;

    this.capi = new Capi({
      AppId: this.credentials.AppId,
      SecretId: this.credentials.SecretId,
      SecretKey: this.credentials.SecretKey,
      Token: this.credentials.Token,
    });
  }

  async purgeCdnUrls(urls, flushType = 'flush') {
    console.log(`Purging CDN caches, it will work in 5 minutes...`);
    try {
      await PurgePathCache(this.capi, {
        Urls: urls,
        FlushType: flushType,
      });
    } catch (e) {
      // no op
    }
  }

  async pushCdnUrls(urls, userAgent = 'flush', area = 'mainland') {
    console.log(`Pushing CDN caches...`);
    try {
      await PushUrlsCache(this.capi, {
        Urls: urls,
        Area: area,
        UserAgent: userAgent,
      });
    } catch (e) {
      // no op
    }
  }

  async offlineCdnDomain(domain) {
    const { Status } = await getCdnByDomain(this.capi, domain);
    if (Status === 'online') {
      // disable first
      await StopCdnDomain(this.capi, { Domain: domain });
    } else if (Status === 'processing') {
      throw new Error(`Status is not operational for ${domain}`);
    }
  }

  async deploy(inputs = {}) {
    const { oldState = {} } = inputs;
    delete inputs.oldState;
    const {
      Async = false,
      OnlyRefresh = false,
      Domain,
      Origin,
      ServiceType = 'web',
      Area = 'mainland',
      Https,
      Cache,
      IpFilter,
      IpFreqLimit,
      StatusCodeCache,
      ForceRedirect,
      Compression,
      BandwidthAlert,
      RangeOriginPull,
      FollowRedirect,
      ErrorPage,
      RequestHeader,
      ResponseHeader,
      DownstreamCapping,
      CacheKey,
      ResponseHeaderCache,
      VideoSeek,
      OriginPullOptimization,
      Authentication,
      Seo,
      Referer,
      MaxAge,
      SpecificConfig,
      OriginPullTimeout,
      RefreshCdn,
      PushCdn,
    } = camelCaseProperty(inputs);

    // only refresh cdn
    if (OnlyRefresh === true) {
      const domainExist = await getCdnByDomain(this.capi, Domain);
      // refresh cdn urls
      if (domainExist && RefreshCdn && RefreshCdn.Urls) {
        await this.purgeCdnUrls(RefreshCdn.Urls, RefreshCdn.FlushType);
      }
      return {
        domain: Domain,
        origins: domainExist.Origin.Origins,
        refreshUrls: RefreshCdn.Urls,
      };
    }

    const cdnInputs = flushEmptyValue({
      Domain,
      Origin: formatOrigin(Origin),
      ServiceType,
      Area,
      Cache,
      IpFilter,
      IpFreqLimit,
      StatusCodeCache,
      ForceRedirect,
      Compression,
      BandwidthAlert,
      RangeOriginPull,
      FollowRedirect,
      ErrorPage,
      RequestHeader,
      ResponseHeader,
      DownstreamCapping,
      CacheKey,
      ResponseHeaderCache,
      VideoSeek,
      OriginPullOptimization,
      Authentication,
      Seo,
      Referer,
      MaxAge,
      SpecificConfig,
      OriginPullTimeout,
    });

    const outputs = {
      https: false,
      domain: Domain,
      origins: cdnInputs.Origin.Origins,
      cname: `${Domain}.cdn.dnsv1.com`,
      inputCache: JSON.stringify(cdnInputs),
    };

    if (Https) {
      outputs.https = true;
      cdnInputs.Https = {
        Switch: Https.Switch,
        Http2: Https.Http2 || 'off',
        OcspStapling: Https.OcspStapling || 'off',
        VerifyClient: Https.VerifyClient || 'off',
        CertInfo: formatCertInfo(Https.CertInfo),
      };
    }
    if (ForceRedirect && Https) {
      cdnInputs.ForceRedirect = {
        Switch: ForceRedirect.Switch,
        RedirectStatusCode: ForceRedirect.RedirectStatusCode || 301,
        RedirectType: 'https',
      };
    }

    const cdnInfo = await getCdnByDomain(this.capi, Domain);

    const sourceInputs = JSON.parse(JSON.stringify(cdnInputs));

    const createOrUpdateCdn = async () => {
      if (cdnInfo) {
        // update
        console.log(`The CDN domain ${Domain} has existed.`);
        console.log('Updating...');
        // when update, can not set ServiceType parameter
        await UpdateDomainConfig(this.capi, cdnInputs);
        outputs.resourceId = cdnInfo.ResourceId;
      } else {
        // create
        console.log(`Adding CDN domain ${Domain}...`);
        try {
          await AddCdnDomain(this.capi, cdnInputs);
        } catch (e) {
          if (e.code === 9111) {
            console.log(`Please goto https://console.cloud.tencent.com/cdn open CDN service.`);
          }
          throw e;
        }
        await sleep(1000);
        const detail = await getCdnByDomain(this.capi, Domain);

        outputs.created = true;
        outputs.resourceId = detail && detail.ResourceId;
      }

      console.log('Waiting for CDN deploy success, it maybe cost 5 minutes....');
      // When set syncFlow false, just continue, do not wait for online status.
      if (Async === false) {
        await waitResponse({
          callback: async () => getCdnByDomain(this.capi, Domain),
          targetProp: 'Status',
          targetResponse: 'online',
          timeout: TIMEOUT,
        });

        // push cdn urls
        if (PushCdn && PushCdn.Urls) {
          await this.pushCdnUrls(PushCdn.Urls, PushCdn.Area, PushCdn.UserAgent);
        }

        // refresh cdn urls
        if (RefreshCdn && RefreshCdn.Urls) {
          await this.purgeCdnUrls(RefreshCdn.Urls);
        }
      }
      console.log(`CDN deploy success to domain: ${Domain}`);
    };

    // pass state for cache check
    const { inputCache } = oldState;
    if (inputCache && inputCache === JSON.stringify(sourceInputs)) {
      console.log(`No configuration changes for CDN domain ${Domain}`);
      outputs.resourceId = cdnInfo.ResourceId;
    } else {
      await createOrUpdateCdn();
    }

    return outputs;
  }

  async remove(inputs = {}) {
    const { domain } = inputs;
    if (!domain) {
      throw new TypeError(`PARAMETER_CDN`, 'domain is required');
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
      await StopCdnDomain(this.capi, { Domain: domain });
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
    await DeleteCdnDomain(this.capi, { Domain: domain });
    console.log(`Removed CDN for ${domain}.`);
    return {};
  }
}

module.exports = Cdn;
