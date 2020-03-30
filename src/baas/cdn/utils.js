const fs = require('fs')
const path = require('path')
const { sleep } = require('@ygkit/request')
const { GetHostInfoByHost } = require('./apis')

const ONE_SECOND = 1000
// timeout 5 minutes
const TIMEOUT = 5 * 60 * ONE_SECOND

function formatCache(caches) {
  return caches.map((cache) => [cache.type, cache.rule, cache.time])
}

function formatRefer(refer) {
  return refer ? [refer.type, refer.list, refer.empty] : []
}

async function getPathContent(target) {
  let content = ''

  try {
    const stat = fs.statSync(target)
    if (stat.isFile()) {
      if (path.isAbsolute(target)) {
        content = fs.readFileSync(target, 'base64')
      } else {
        content = fs.readFileSync(path.join(process.cwd(), target), 'base64')
      }
    }
  } catch (e) {
    // target is string just return
    content = target
  }
  return content
}

async function getCdnByHost(capi, host) {
  const { data } = await GetHostInfoByHost(capi, {
    hosts: [host]
  })

  if (data && data.hosts.length) {
    return data.hosts[0]
  }
  return undefined
}

async function waitForNotStatus(capi, host, resolve1 = null, reject1 = null) {
  return new Promise(async (resolve, reject) => {
    try {
      resolve = resolve1 || resolve
      reject = reject1 || reject
      const { id, status } = await getCdnByHost(capi, host)
      // 4: deploying, 1: created
      if (status !== 4 && status !== 1) {
        resolve(id)
      } else {
        await sleep(ONE_SECOND * 5)
        return waitForNotStatus(capi, host, resolve, reject)
      }
    } catch (e) {
      reject(e)
    }
  })
}

module.exports = {
  ONE_SECOND,
  TIMEOUT,
  waitForNotStatus,
  formatCache,
  formatRefer,
  getCdnByHost,
  getPathContent
}
