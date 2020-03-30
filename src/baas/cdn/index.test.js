const Cdn = require('./index')

async function runTest() {
  const credentials = {
    SecretId: '',
    SecretKey: ''
  }
  const inputs = {
    host: 'fullstack.yugasun.com',
    hostType: 'cos',
    origin: 'up6pwd9-89hm718-1251556596.cos-website.ap-guangzhou.myqcloud.com',
    backupOrigin: 'up6pwd9-89hm718-1251556596.cos-website.ap-guangzhou.myqcloud.com',
    serviceType: 'web',
    fullUrl: 'on',
    fwdHost: 'up6pwd9-89hm718-1251556596.cos-website.ap-guangzhou.myqcloud.com',
    cacheMode: 'simple',
    refer: [{ type: 1, list: ['qq.baidu.com', '*.baidu.com'], empty: 0 }],
    https: { http2: 'off', httpsType: 4, forceSwitch: -2, certId: 'Z67aCPcj' }
  }
  const cdn = new Cdn(credentials, inputs.region)
  const outputs = await cdn.deploy(inputs)
  console.log(outputs)

  await cdn.remove(outputs)
}

runTest()
