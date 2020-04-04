const secret = require('../../../../secret')
const ScfUtils = require('./index').Scf

class ClientTest {
	async scfTest() {
		const scf = new ScfUtils({
			SecretId: secret.SecretId,
			SecretKey: secret.SecretKey
		})
		const scfDemo = {
			name: 'myFunction1',
			code: {
				bucket: 'sls-cloudfunction-ap-guangzhou',
				object: 'sls-cloudfunction-default-hello_world-1584670117.zip'
			},
			handler: 'index.main_handler',
			runtime: 'Python3.6',
			role: 'SCF_PythonLogsRole',
			// eip: true,
			region: 'ap-shanghai',
			description: 'My Serverless Function',
			memorySize: '256',
			timeout: '20',
			tags: {
				mytest: 'abc'
			},
			environment: {
				variables: {
					TEST: 'value'
				}
			},
			events: [
				{
					timer: {
						name: 'timer',
						parameters: {
							cronExpression: '*/6 * * * *',
							enable: true,
							argument: 'mytest argument'
						}
					}
				},
				{
					apigw: {
						name: 'serverless',
						parameters: {
							protocols: ['http'],
							serviceName: 'serverless',
							description: 'the serverless service',
							environment: 'release',
							endpoints: [{
								path: '/users',
								method: 'POST'
							}]
						}

					}
				}
			]
		}
		const result = await scf.deploy(scfDemo)
		console.log(JSON.stringify(result))
		console.log(await scf.invoke(result.FunctionName))
		await scf.remove(result)
	}
}

new ClientTest().scfTest()

/* 测试结果：
	Creating funtion myFunction1 in ap-guangzhou ...
	Getting function myFunction1's configure ...
	Adding tags for funtion myFunction1 in ap-guangzhou ...
	Deploying myFunction1's triggers in ap-guangzhou.
	Checking function myFunction1 status ...
	Modify tags ...
	Modified tags.
	Checking function myFunction1 status ...
	Deploying timer triggers: timer.
	Deployed funtion undefined.
	{"RequestId":"ea9d3a73-1842-413a-be71-56a7bc385381","ModTime":"2020-03-27 17:12:40","CodeInfo":"","Description":"My Serverless Function","Triggers":[{"Response":{"RequestId":"210e2f21-0ac9-4259-99d3-e2abf4d1b159","TriggerInfo":{"AddTime":"2020-03-27 17:12:44","AvailableStatus":"Available","CustomArgument":"mytest argument","Enable":1,"ModTime":"2020-03-27 17:12:44","TriggerDesc":"{\"cron\":\"0 *6"}","TriggerName":"timer","Type":"timer"}}}],"Handler":"index.main_handler","CodeSize":0,"Timeout":20,"FunctionVersion":"$LATEST","MemorySize":256,"Runtime":"Python3.6","FunctionName":"myFunction1","VpcConfig":{"VpcId":"","SubnetId":""},"UseGpu":"FALSE","Environment":{"Variables":[{"Key":"TEST","Value":"value"}]},"CodeResult":"success","CodeError":"","ErrNo":0,"Namespace":"default","Role":"SCF_PythonLogsRole","InstallDependency":"FALSE","Status":"Creating","StatusDesc":"","ClsLogsetId":"","ClsTopicId":"","FunctionId":"lam-r19fhf72","Tags":[],"EipConfig":{"EipFixed":"FALSE","Eips":[]},"AccessInfo":{"Host":"","Vip":""},"Type":"Event","DeadLetterConfig":{"Type":"","Name":"","FilterType":""},"Layers":[],"L5Enable":"FALSE","AddTime":"2020-03-27 17:12:40","PublicNetConfig":{"PublicNetStatus":"ENABLE","EipConfig":{"EipStatus":"DISABLE","EipAddress":[]}},"OnsEnable":"FALSE"}
	{
		RequestId: '02ff599b-5720-4dfb-94c0-b3f333868d31',
			Result: {
		BillDuration: 2,
			Duration: 2,
			ErrMsg: '',
			FunctionRequestId: '02ff599b-5720-4dfb-94c0-b3f333868d31',
			InvokeResult: 0,
			Log: 'START RequestId: 02ff599b-5720-4dfb-94c0-b3f333868d31\n' +
		'Event RequestId: 02ff599b-5720-4dfb-94c0-b3f333868d31\n' +
		'{}\n' +
		'Received event: {}\n' +
		`Received context: {'memory_limit_in_mb': 256, 'time_limit_in_ms': 20000, 'request_id': '02ff599b-5720-4dfb-94c0-b3f333868d31', 'environment': '{"TENCENTCLOUD_SECRETID":"AKIDPH1aD0k43GtL17YuoszTJYKABNa6B8FAddTfay3WoYMb79G9QXSesbSz2yiREMdN","TENCENTCLOUD_SECRETKEY":"LtunGCMtsfkGqQmgDECkHkskse5+WennrMPJbreXE84=","TENCENTCLOUD_SESSIONTOKEN":"26Z03TWGXBrt0b3QHemtqOdM4s6vEMe6d455a7dd94c5e489a1cdea1b1126f5e8-M_KpWmubhn_Xgr0j6ULJItvuEYSCcQGWgWyvW39L8nksAfRnzKx-CsGcYXRTVyq7_SrldrOZwHgYf3lzQKXkt9qJ4tGb50VmLmaCoSWy8D8ggbbeJ4vaj_DRg_QE8ZBm6fMlSdRkKe95MqkN0Sukmj_OVjG_tv6pr-svZiAEsspT6Ga5QwuBecFl7sJOE8GpgmfUQKEa68284ryfMCd0SRZXaP1FfMefozBabrwD28lWLtwh8a7L3vklOhTIFZSL_tyZO1AGMvKasiuGjuvqm7mKQeq5fUaFJkBdblX9hbFLdQZoQ8tLxv2yz0rjiBQGTXrC901kb1NqZqJISQlAVikaqdetDIxnvrq3bI881U","TEST":"value"}', 'environ': 'TEST=value;TENCENTCLOUD_SESSIONTOKEN=26Z03TWGXBrt0b3QHemtqOdM4s6vEMe6d455a7dd94c5e489a1cdea1b1126f5e8-M_KpWmubhn_Xgr0j6ULJItvuEYSCcQGWgWyvW39L8nksAfRnzKx-CsGcYXRTVyq7_SrldrOZwHgYf3lzQKXkt9qJ4tGb50VmLmaCoSWy8D8ggbbeJ4vaj_DRg_QE8ZBm6fMlSdRkKe95MqkN0Sukmj_OVjG_tv6pr-svZiAEsspT6Ga5QwuBecFl7sJOE8GpgmfUQKEa68284ryfMCd0SRZXaP1FfMefozBabrwD28lWLtwh8a7L3vklOhTIFZSL_tyZO1AGMvKasiuGjuvqm7mKQeq5fUaFJkBdblX9hbFLdQZoQ8tLxv2yz0rjiBQGTXrC901kb1NqZqJISQlAVikaqdetDIxnvrq3bI881U;TENCENTCLOUD_SECRETID=AKIDPH1aD0k43GtL17YuoszTJYKABNa6B8FAddTfay3WoYMb79G9QXSesbSz2yiREMdN;TENCENTCLOUD_SECRETKEY=LtunGCMtsfkGqQmgDECkHkskse5+WennrMPJbreXE84=;SCF_NAMESPACE=default', 'function_version': '$LATEST', 'function_name': 'myFunction1', 'namespace': 'default'}\n` +
		'Hello world\n' +
		'\n' +
		'END RequestId: 02ff599b-5720-4dfb-94c0-b3f333868d31\n' +
		'Report RequestId: 02ff599b-5720-4dfb-94c0-b3f333868d31 Duration:2ms Memory:256MB MemUsage:11.2188MB',
			MemUsage: 11763712,
			RetMsg: '"Hello World"'
	}
	}
	Deleteing funtion myFunction1 ...
	Removed function and triggers.
*/
