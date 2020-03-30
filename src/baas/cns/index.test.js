const secret = require('../../../../secret')
const CnsUtils = require('./index')

class ClientTest {
  async cnsTest() {
    const cns = new CnsUtils({
      SecretId: secret.SecretId,
      SecretKey: secret.SecretKey
    })
    const cnsDemo = {
      domain: 'anycodes.cn',
      records: [
        {
          subDomain: ['abc', 'cde'],
          recordType: 'CNAME',
          recordLine: ['移动', '电信'],
          value: 'cname1.dnspod.com',
          ttl: 600,
          mx: 10,
          status: 'enable'
        },
        {
          subDomain: 'xyz',
          recordType: 'CNAME',
          recordLine: '默认',
          value: 'cname2.dnspod.com',
          ttl: 600,
          mx: 10,
          status: 'enable'
        }
      ]
    }
    const result = await cns.deploy(cnsDemo)
    console.log(JSON.stringify(result))
    console.log(result)
    console.log(await cns.remove({ deleteList: result.records }))
  }
}

new ClientTest().cnsTest()

/* 测试结果：
	Getting release domain records ...
	Getted release domain.
	Doing action about domain records ...
	Resolving abc - cname1.dnspod.com
	Creating ...
	Created (recordId is 562263334)
	Modifying status to enable
	Modified status to enable
	Resolving abc - cname1.dnspod.com
	Creating ...
	Created (recordId is 562263340)
	Modifying status to enable
	Modified status to enable
	Resolving cde - cname1.dnspod.com
	Creating ...
	Created (recordId is 562263381)
	Modifying status to enable
	Modified status to enable
	Resolving cde - cname1.dnspod.com
	Creating ...
	Created (recordId is 562263465)
	Modifying status to enable
	Modified status to enable
	Resolving xyz - cname2.dnspod.com
	Creating ...
	Created (recordId is 562263473)
	Modifying status to enable
	Modified status to enable
	{"logs":{"records":[{"subDomain":"abc","recordType":"CNAME","recordLine":"移动","recordId":"562263334","value":"cname1.dnspod.com.","status":"enable","domain":"anycodes.cn"},{"subDomain":"abc","recordType":"CNAME","recordLine":"电信","recordId":"562263340","value":"cname1.dnspod.com.","status":"enable","domain":"anycodes.cn"},{"subDomain":"cde","recordType":"CNAME","recordLine":"移动","recordId":"562263381","value":"cname1.dnspod.com.","status":"enable","domain":"anycodes.cn"},{"subDomain":"cde","recordType":"CNAME","recordLine":"电信","recordId":"562263465","value":"cname1.dnspod.com.","status":"enable","domain":"anycodes.cn"},{"subDomain":"xyz","recordType":"CNAME","recordLine":"默认","recordId":"562263473","value":"cname2.dnspod.com.","status":"enable","domain":"anycodes.cn"}]},"error":[]}
	{
		logs: { records: [ [Object], [Object], [Object], [Object], [Object] ] },
		error: []
	}
	Deleting records which deployed by this project, but not in this records list.
	Deleting record abc 562263334
	Deleted record abc 562263334
	Deleting record abc 562263340
	Deleted record abc 562263340
	Deleting record cde 562263381
	Deleted record cde 562263381
	Deleting record cde 562263465
	Deleted record cde 562263465
	Deleting record xyz 562263473
	Deleted record xyz 562263473
	{ logs: {}, error: [] }
*/
