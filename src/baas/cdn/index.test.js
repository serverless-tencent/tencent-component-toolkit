const Cdn = require('./index')

async function runTest() {
  const credentials = {
    SecretId: '',
    SecretKey: ''
  }

  // const inputs = {
  //   async: true,
  //   area: 'global',
  //   domain: 'fullstack.yugasun.com',
  //   serviceType: 'web',
  //   origin: {
  //     origins: ['up6pwd9-89hm718-xxx.cos-website.ap-guangzhou.myqcloud.com'],
  //     originType: 'domain',
  //     originPullProtocol: 'https',
  //     serverName: 'up6pwd9-89hm718-xxx.cos-website.ap-guangzhou.myqcloud.com'
  //   },
  //   https: {
  //     switch: 'on',
  //     http2: 'on',
  //     certInfo: {
  //       certId: 'xxx'
  //     }
  //   },
  //   forceRedirect: {
  //     switch: 'on',
  //     redirectType: 'https',
  //     redirectStatusCode: 301
  //   },
  //   refreshCdn: {
  //     urls: [
  //       'https://fullstack.yugasun.com'
  //     ]
  //   }
  // }
  const inputs = {
    area: 'overseas',
    domain: 'fullstack.yugasun.com',
    hostType: 'cos',
    origin: {
      origins: ['up6pwd9-89hm718-xxx.cos-website.ap-guangzhou.myqcloud.com'],
      originType: 'cos',
      originPullProtocol: 'https',
    },
    serviceType: 'web',
    https: {
      switch: 'on',
      http2: 'on',
      certInfo: {
        certId: 'xxx'
      }
    },
    forceRedirect: {
      switch: 'on',
      redirectType: 'https',
      redirectStatusCode: 301
    }
  }
  const cdn = new Cdn(credentials, inputs.region)
  const outputs = await cdn.deploy(inputs)
  console.log(outputs)

  // await cdn.remove({
  //   domain: 'fullstack.yugasun.com'
  // })
}

runTest()


process.on('unhandledRejection', (e) => {
  console.log(e);

})
