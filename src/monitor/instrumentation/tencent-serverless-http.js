const utils = require('../utils')
const { REUQEST_START_KEY } = require('../constants')
const report = require('../report')

module.exports = function initialize(agent, httpProxy) {
  utils.wrapMethod(httpProxy, 'proxy', function wrapRoute(fn) {
    return function(server, event, context) {
      context[REUQEST_START_KEY] = Date.now()
      const proxy = fn.apply(this, arguments)
      return new Promise(function(resolve) {
        agent.on('responseFinish', function(ctx, method, path, responseCode) {
          report.reportHttp(ctx, method, path, responseCode).then(
            function() {
              resolve(proxy)
            },
            function() {
              resolve(proxy)
            }
          )
        })
      })
    }
  })
}
