var COS = require('cos-nodejs-sdk-v5')
var cos = new COS({
  SecretId: 'AKID1ynRAoVcoqrDUbwR9RbcS7mKrOl1q0kK',
  SecretKey: 'cCoJncN0BHLG2jGvcAYlXWRI5kFZj5Oa'
})
cos.putBucketLifecycle(
  {
    Bucket: 'my-bucket1-1256773370',
    Region: 'ap-guangzhou',
    Rules: [
      {
        ID: 'deleteObject',
        Status: 'Enabled',
        Filter: '',
        Expiration: {
          Days: '10'
        },
        AbortIncompleteMultipartUpload: {
          DaysAfterInitiation: '10'
        }
      }
    ],
    stsAction: 'cos:PutBucketLifeCycle'
  },
  function(err, data) {
    console.log(err || data)
  }
)
