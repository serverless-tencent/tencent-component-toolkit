const { Capi } = require('@tencent-sdk/capi')
const { waitResponse } = require('@ygkit/request')
const { AddCdnHost, SetHttpsInfo, UpdateCdnConfig, OfflineHost, DeleteCdnHost } = require('./apis')
const {
  TIMEOUT,
  formatCache,
  formatRefer,
  getCdnByHost,
  getPathContent,
  waitForNotStatus
} = require('./utils')

class Cdn {
  constructor(credentials = {}) {
    this.credentials = credentials
  }

  async deploy(inputs = {}) {
    const {
      host,
      hostType,
      origin,
      oldState = {},
      backupOrigin = '',
      serviceType = 'web',
      fullUrl = 'off',
      fwdHost,
      cache,
      cacheMode = 'simple',
      refer,
      accessIp,
      https
    } = inputs

    const capi = new Capi({
      AppId: this.credentials.AppId,
      SecretId: this.credentials.SecretId,
      SecretKey: this.credentials.SecretKey,
      Token: this.credentials.Token
    })

    const cdnInputs = {
      host: host,
      projectId: 0,
      hostType: hostType,
      origin: origin,
      backupOrigin: backupOrigin,
      serviceType: serviceType,
      fullUrl: fullUrl,
      fwdHost: fwdHost || host,
      cacheMode: cacheMode
    }

    if (cache) {
      cdnInputs.cache = JSON.stringify(formatCache(cache))
    }
    if (refer) {
      cdnInputs.refer = JSON.stringify(formatRefer(refer[0]))
    }
    if (accessIp) {
      cdnInputs.accessIp = JSON.stringify(accessIp)
    }

    const cdnInfo = await getCdnByHost(capi, host)

    const sourceInputs = JSON.parse(JSON.stringify(inputs))
    const sourceHttpsConf = sourceInputs.https
    const sourceBaseConf = {}
    Object.keys(sourceInputs).forEach((key) => {
      if (key !== 'https') {
        sourceBaseConf[key] = sourceInputs[key]
      }
    })
    const outputs = {
      host: host,
      origin: origin,
      cname: `${host}.cdn.dnsv1.com`,
      inputCache: {
        base: JSON.stringify(sourceBaseConf),
        https: JSON.stringify(sourceHttpsConf)
      }
    }

    const createOrUpdateCdn = async () => {
      if (cdnInfo) {
        // update
        console.debug(`The CDN domain ${host} has existed.`)
        console.debug('Updating...')
        cdnInputs.hostId = cdnInfo.id
        await UpdateCdnConfig(capi, cdnInputs)
        outputs.hostId = cdnInfo.id
      } else {
        // create
        console.debug(`Adding CDN domain ${host}...`)
        try {
          await AddCdnHost(capi, cdnInputs)
        } catch (e) {
          if (e.code === 9111) {
            console.debug(`Please goto https://console.cloud.tencent.com/cdn open CDN service.`)
          }
        }
        const { id } = await getCdnByHost(capi, host)
        outputs.created = true
        outputs.hostId = id
      }

      // state=4: deploying status, we can not do any operation
      console.debug('Waiting for CDN deploy success...')
      await waitResponse({
        callback: async () => getCdnByHost(capi, host),
        targetProp: 'status',
        targetResponse: 5,
        timeout: TIMEOUT
      })
      console.debug(`CDN deploy success to host: ${host}`)
    }

    const creatOrUpdateHttps = async () => {
      if (https) {
        console.debug(`Setup https for ${host}...`)
        // update https
        const httpsInputs = {
          host: host,
          httpsType: https.httpsType,
          forceSwitch: https.forceSwitch,
          http2: https.http2
        }
        // if set certId, it is prefered
        if (https.certId) {
          httpsInputs.certId = https.certId
        } else {
          const certContent = await getPathContent(https.cert)
          const privateKeyContent = await getPathContent(https.privateKey)
          httpsInputs.cert = certContent
          httpsInputs.privateKey = privateKeyContent
        }

        await SetHttpsInfo(capi, httpsInputs)
        outputs.https = true
      } else {
        console.debug(`Removing https for ${host}...`)
        // delete https
        const httpsInputs = {
          host: host,
          httpsType: 0
        }
        await SetHttpsInfo(capi, httpsInputs)
        outputs.https = false
      }
      await waitResponse({
        callback: async () => getCdnByHost(capi, host),
        targetProp: 'status',
        targetResponse: 5,
        timeout: TIMEOUT
      })
    }

    // pass state for cache check
    const { inputCache } = oldState
    if (inputCache && inputCache.base === JSON.stringify(sourceBaseConf)) {
      console.debug(`No base configuration changes for CDN domain ${host}`)
      outputs.hostId = cdnInfo.id
    } else {
      await createOrUpdateCdn()
    }

    if (inputCache && inputCache.https === JSON.stringify(sourceHttpsConf)) {
      console.debug(`No https configuration changes for CDN domain ${host}`)
      outputs.https = !!sourceHttpsConf
    } else {
      await creatOrUpdateHttps()
    }

    return outputs
  }

  async remove(inputs = {}) {
    const capi = new Capi({
      SecretId: this.credentials.SecretId,
      SecretKey: this.credentials.SecretKey,
      Token: this.credentials.Token
    })

    const { host } = inputs
    if (!host) {
      throw new Error('host is required')
    }

    // need circle for deleting, after host status is 6, then we can delete it
    console.debug(`Start removing CDN for ${host}`)
    const { status } = await getCdnByHost(capi, host)
    // status=5: online
    // state=4: deploying
    // state=6: offline
    if (status === 5) {
      // disable first
      await OfflineHost(capi, { host: host })
      console.debug(`Waiting for offline ${host}...`)
      await waitResponse({
        callback: async () => getCdnByHost(capi, host),
        targetProp: 'status',
        targetResponse: 6,
        timeout: TIMEOUT
      })
    } else if (status === 4) {
      throw new Error(`Status is not operational for ${host}`)
    }
    console.debug(`Removing CDN for ${host}`)
    await DeleteCdnHost(capi, { host: host })
    console.debug(`Removed CDN for ${host}.`)
    return {}
  }
}

module.exports = Cdn
