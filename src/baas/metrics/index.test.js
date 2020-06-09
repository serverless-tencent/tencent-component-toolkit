const MetricsUtils = require('./index');

class ClientTest {
    async metricsTest() {
        const client = new MetricsUtils({
            SecretId: '',
            SecretKey: '',
        }, {
            funcName: 'express_component_6bonhko',
        });
        const ret = await client.getDatas('2020-06-09 10:00:00', '2020-06-09 11:00:00');
        console.log(ret);
    }
}

new ClientTest().metricsTest();

process.on('unhandledRejection', (e) => {
  throw e;
});
