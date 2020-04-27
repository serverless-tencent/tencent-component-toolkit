const shimmer = require('./shimmer')
const Agent = require('./agent')

initialize()
function initialize () {
    const agent = new Agent()
    // 封装 module的_load方法，在load时针对基础组件附加探针
    shimmer.patchModule()
    // 初始化一系列基础组件
    shimmer.bootstrapInstrumentation(agent)
}