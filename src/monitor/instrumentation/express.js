'use strict'
const utils = require('../utils')

/**
 * Express middleware generates traces where middleware are considered siblings
 * (ended on 'next' invocation) and not nested. Middlware are nested below the
 * routers they are mounted to.
 */

module.exports = function initialize (agent, express) {

    if (!express || !express.Router) {
        return false
    }

    //wrapExpress4(express)
    utils.wrapMethod(express.Router, 'route', function wrapRoute (fn) {
        if (!utils.isFunction(fn)) {
            return fn
        }

        return function wrappedRoute () {
            const route = fn.apply(this, arguments)
            // Express should create a new route and layer every time Router#route is
            // called, but just to be on the safe side, make sure we haven't wrapped
            // this already.
            if (!utils.isWrapped(route, 'get')) {
                wrapRouteMethods(route)

                const layer = this.stack[this.stack.length - 1]
                utils.wrapMethod(layer, 'handle', function (fn) {
                    const { route } = layer
                    const { path } = route
                    return function (request, response) {
                        function finish () {
                            response.removeListener('finish', finish)
                            request.removeListener('aborted', finish)
                            // 状态码
                            if (response.statusCode != null) {
                                const responseCode = String(response.statusCode)
                                if (/^\d+$/.test(responseCode)) {
                                    const context = request.headers['x-apigateway-context']
                                    agent.emit('responseFinish', context, request.method, path, responseCode)
                                }
                            }
                        }

                        // response结束时上报状态码和耗时
                        response.once('finish', finish)
                        request.once('aborted', finish)

                        const handle = fn.apply(this, arguments)
                        return handle
                    }
                })
            }
            return route
        }
    })
}

function wrapRouteMethods (route) {
    const methods = ['all', 'delete', 'get', 'head', 'opts', 'post', 'put', 'patch']
    utils.wrapMethod(route, methods, function (fn) {
        return fn
    })
}
