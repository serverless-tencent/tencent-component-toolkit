/**
 * Enumeration of module instrumentation types.
 *
 * @private
 * @readonly
 * @enum {string}
 */
const MODULE_TYPE = {
    /** Web server framework module, such as Express or Koa. */
    WEB_FRAMEWORK: 'web-framework',
    PROXY: 'proxy'
}

exports.MODULE_TYPE = MODULE_TYPE

/**
 * 请求开始时间存储key值(context内)
 */
const REUQEST_START = '__request_start__'

exports.REUQEST_START_KEY = REUQEST_START