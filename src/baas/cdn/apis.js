function HttpError(code, message) {
  this.code = code || 0
  this.message = message || ''
}

HttpError.prototype = Error.prototype

function isEmpty(val) {
  return val === undefined || val === null || (typeof val === 'number' && isNaN(val))
}

function cleanEmptyValue(obj) {
  const newObj = {}
  for (const key in obj) {
    const val = obj[key]
    if (!isEmpty(val)) {
      newObj[key] = val
    }
  }
  return newObj
}

function apiFactory(actions) {
  const apis = {}
  actions.forEach((action) => {
    apis[action] = async (capi, inputs) => {
      inputs = cleanEmptyValue(inputs)
      const res = await capi.request(
        {
          Action: action,
          RequestClient: 'ServerlessComponent',
          Token: capi.options.Token || null,
          ...inputs
        },
        {
          Version: '2017-03-12',
          ServiceType: 'cdn',
          bashHost: 'api.qcloud.com',
          path: '/v2/index.php'
        }
      )
      if (res.code !== 0) {
        throw new HttpError(res.code, res.message)
      }
      return res
    }
  })

  return apis
}

const ACTIONS = [
  'AddCdnHost',
  'SetHttpsInfo',
  'GetHostInfoByHost',
  'DeleteCdnHost',
  'OfflineHost',
  'UpdateCdnConfig'
]
const APIS = apiFactory(ACTIONS)

module.exports = APIS
