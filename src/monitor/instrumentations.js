'use strict'

const MODULE_TYPE = require('./constants').MODULE_TYPE

module.exports = function instrumentations () {
    return {
        'express': { type: MODULE_TYPE.WEB_FRAMEWORK },
        'tencent-serverless-http': { type: MODULE_TYPE.PROXY },
    }
}
