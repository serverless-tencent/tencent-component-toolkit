const secret = require('../../../../secret')
const MetricsUtils = require('./index')

class ClientTest {
    async metricsTest() {
        const client = new MetricsUtils({
            SecretId: secret.SecretId,
            SecretKey: secret.SecretKey
        }, {
            funcName: 'funcName'
        })
        const ret = await client.getDatas('2020-05-13 17:00:00', '2020-05-14 17:00:00')
        console.log(ret)
    }
}

new ClientTest().metricsTest()