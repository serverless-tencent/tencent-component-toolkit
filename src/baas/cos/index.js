const { cos } = require('tencent-cloud-sdk')
const util = require('util')
const path = require('path')
const fs = require('fs')
const klawSync = require('klaw-sync')
const exec = util.promisify(require('child_process').exec)

class Cos {
  constructor(credentials = {}, region = 'ap-guangzhou') {
    this.region = region
    this.credentials = credentials
    // cos临时密钥需要用XCosSecurityToken
    if (credentials.token) {
      this.credentials.XCosSecurityToken = credentials.token
    }
    if (credentials.Token) {
      this.credentials.XCosSecurityToken = credentials.Token
    }
    this.cosClient = new cos(this.credentials)
  }

  async createBucket(inputs = {}) {
    console.log(`Creating bucket: ${inputs.bucket} in ${this.region}  ...`)
    const createParams = {
      Bucket: inputs.bucket,
      Region: this.region
    }
    const createHandler = util.promisify(this.cosClient.putBucket.bind(this.cosClient))
    try {
      await createHandler(createParams)
    } catch (e) {
      if (e.error.Code == 'BucketAlreadyExists' || e.error.Code == 'BucketAlreadyOwnedByYou') {
        if (!inputs.force) {
          throw new Error(JSON.stringify(e))
        }
      } else {
        throw new Error(JSON.stringify(e))
      }
    }
  }

  async setAcl(inputs = {}) {
    console.log(`Setting acl for ${this.region}'s bucket: ${inputs.bucket} ...`)
    const setAclParams = {
      Bucket: inputs.bucket,
      Region: this.region
    }
    if (inputs.acl.permissions) {
      setAclParams.ACL = inputs.acl.permissions
    }
    if (inputs.acl.grantRead) {
      setAclParams.GrantRead = inputs.acl.grantRead
    }
    if (inputs.acl.grantWrite) {
      setAclParams.GrantWrite = inputs.acl.grantWrite
    }
    if (inputs.acl.grantReadAcp) {
      setAclParams.GrantReadAcp = inputs.acl.grantReadAcp
    }
    if (inputs.acl.grantWriteAcp) {
      setAclParams.GrantWriteAcp = inputs.acl.grantWriteAcp
    }
    if (inputs.acl.grantFullControl) {
      setAclParams.GrantFullControl = inputs.acl.grantFullControl
    }
    if (inputs.acl.accessControlPolicy) {
      const accessControlPolicy = {}
      if (inputs.acl.accessControlPolicy.owner && inputs.acl.accessControlPolicy.owner.id) {
        accessControlPolicy.Owner = {
          ID: inputs.acl.accessControlPolicy.owner.id
        }
      }
      if (inputs.acl.accessControlPolicy.grants) {
        accessControlPolicy.Grants = {}
        if (inputs.acl.accessControlPolicy.grants.permission) {
          accessControlPolicy.Grants.Permission = inputs.acl.accessControlPolicy.grants.permission
        }
        if (inputs.acl.accessControlPolicy.grants.grantee) {
          accessControlPolicy.Grants.Grantee = {}
          if (inputs.acl.accessControlPolicy.grants.grantee.id) {
            accessControlPolicy.Grants.Grantee.ID = inputs.acl.accessControlPolicy.grants.grantee.id
          }
          if (inputs.acl.accessControlPolicy.grants.grantee.displayName) {
            accessControlPolicy.Grants.Grantee.DisplayName =
              inputs.acl.accessControlPolicy.grants.grantee.displayName
          }
          if (inputs.acl.accessControlPolicy.grants.grantee.uri) {
            accessControlPolicy.Grants.Grantee.URI =
              inputs.acl.accessControlPolicy.grants.grantee.uri
          }
        }
      }
      setAclParams.AccessControlPolicy = accessControlPolicy
    }
    const setAclHandler = util.promisify(this.cosClient.putBucketAcl.bind(this.cosClient))
    try {
      await setAclHandler(setAclParams)
    } catch (e) {
      throw new Error(JSON.stringify(e))
    }
  }

  async setTags(inputs = {}) {
    console.log(`Setting tags for ${this.region}'s bucket: ${inputs.bucket} ...`)
    const tags = []
    for (let i = 0; i < inputs.tags.length; i++) {
      tags.push({
        Key: inputs.tags[i].key,
        Value: inputs.tags[i].value
      })
    }
    const setTagsParams = {
      Bucket: inputs.bucket,
      Region: this.region,
      Tagging: {
        Tags: tags
      }
    }
    const setTagsHandler = util.promisify(this.cosClient.putBucketTagging.bind(this.cosClient))
    try {
      await setTagsHandler(setTagsParams)
    } catch (e) {
      throw new Error(JSON.stringify(e))
    }
  }

  async deleteTags(inputs = {}) {
    console.log(`Deleting tags for ${this.region}'s bucket: ${inputs.bucket} ...`)
    const deleteTagsHandler = util.promisify(
      this.cosClient.deleteBucketTagging.bind(this.cosClient)
    )
    try {
      await deleteTagsHandler({
        Bucket: inputs.bucket,
        Region: this.region
      })
    } catch (e) {
      throw new Error(JSON.stringify(e))
    }
  }

  async setCors(inputs = {}) {
    console.log(`Setting lifecycle for ${this.region}'s bucket: ${inputs.bucket} ...`)
    const cors = []
    for (let i = 0; i < inputs.cors.length; i++) {
      const tempCors = {
        AllowedMethods: inputs.cors[i].allowedMethods,
        AllowedOrigins: inputs.cors[i].allowedOrigins
      }
      if (inputs.cors[i].maxAgeSeconds) {
        tempCors.MaxAgeSeconds = String(inputs.cors[i].maxAgeSeconds)
      }
      if (inputs.cors[i].id) {
        tempCors.ID = inputs.cors[i].id
      }
      if (inputs.cors[i].allowedHeaders) {
        tempCors.AllowedHeaders = inputs.cors[i].allowedHeaders
      }
      if (inputs.cors[i].exposeHeaders) {
        tempCors.ExposeHeaders = inputs.cors[i].exposeHeaders
      }
      cors.push(tempCors)
    }
    const setCorsParams = {
      Bucket: inputs.bucket,
      Region: this.region,
      CORSRules: cors
    }
    const setCorsHandler = util.promisify(this.cosClient.putBucketCors.bind(this.cosClient))
    try {
      await setCorsHandler(setCorsParams)
    } catch (e) {
      throw new Error(JSON.stringify(e))
    }
  }

  async deleteCors(inputs = {}) {
    console.log(`Deleting cors for ${this.region}'s bucket: ${inputs.bucket} ...`)
    const deleteCorsHandler = util.promisify(this.cosClient.deleteBucketCors.bind(this.cosClient))
    try {
      await deleteCorsHandler({
        Bucket: inputs.bucket,
        Region: this.region
      })
    } catch (e) {
      throw new Error(JSON.stringify(e))
    }
  }

  async setLifecycle(inputs = {}) {
    console.log(`Setting lifecycle for ${this.region}'s bucket: ${inputs.bucket} ...`)
    const lifecycle = []
    for (let i = 0; i < inputs.lifecycle.length; i++) {
      const tempLifecycle = {
        ID: inputs.lifecycle[i].id,
        Status: inputs.lifecycle[i].status,
        Filter: {}
      }
      if (inputs.lifecycle[i].filter && inputs.lifecycle[i].filter.prefix) {
        tempLifecycle.Filter.Prefix = inputs.lifecycle[i].filter.prefix
      }
      if (inputs.lifecycle[i].transition) {
        tempLifecycle.Transition = {
          Days: Number(inputs.lifecycle[i].transition.days)
        }
        if (inputs.lifecycle[i].transition.storageClass) {
          tempLifecycle.Transition.StorageClass = inputs.lifecycle[i].transition.storageClass
        }
      }
      if (inputs.lifecycle[i].noncurrentVersionTransition) {
        tempLifecycle.NoncurrentVersionTransition = {
          NoncurrentDays: Number(inputs.lifecycle[i].NoncurrentVersionTransition.noncurrentDays),
          StorageClass: inputs.lifecycle[i].NoncurrentVersionTransition.storageClass
        }
      }
      if (inputs.lifecycle[i].expiration) {
        tempLifecycle.Expiration = {
          Days: Number(inputs.lifecycle[i].expiration.days),
          ExpiredObjectDeleteMarker: inputs.lifecycle[i].expiration.expiredObjectDeleteMarker
        }
      }
      if (inputs.lifecycle[i].abortIncompleteMultipartUpload) {
        tempLifecycle.AbortIncompleteMultipartUpload = {
          DaysAfterInitiation: Number(
            inputs.lifecycle[i].abortIncompleteMultipartUpload.daysAfterInitiation
          )
        }
      }
      lifecycle.push(tempLifecycle)
    }
    const setLifecycleParams = {
      Bucket: inputs.bucket,
      Region: this.region,
      Rules: lifecycle
    }
    const setLifecycleHandler = util.promisify(
      this.cosClient.putBucketLifecycle.bind(this.cosClient)
    )
    try {
      await setLifecycleHandler(JSON.parse(JSON.stringify(setLifecycleParams)))
    } catch (e) {
      throw new Error(JSON.stringify(e))
    }
  }

  async deleteLifecycle(inputs = {}) {
    console.log(`Deleting lifecycle for ${this.region}'s bucket: ${inputs.bucket} ...`)
    const deleteLifecycle = util.promisify(
      this.cosClient.deleteBucketLifecycle.bind(this.cosClient)
    )
    try {
      await deleteLifecycle({
        Bucket: inputs.bucket,
        Region: this.region
      })
    } catch (e) {
      throw new Error(JSON.stringify(e))
    }
  }

  async setVersioning(inputs = {}) {
    console.log(`Setting versioning for ${this.region}'s bucket: ${inputs.bucket} ...`)

    const setVersioningParams = {
      Bucket: inputs.bucket,
      Region: this.region,
      VersioningConfiguration: {
        Status: inputs.versioning
      }
    }
    const setVersioningHandler = util.promisify(
      this.cosClient.putBucketVersioning.bind(this.cosClient)
    )
    try {
      await setVersioningHandler(setVersioningParams)
    } catch (e) {
      throw new Error(JSON.stringify(e))
    }
  }

  async setWebsite(inputs = {}) {
    console.log(`Setting Website for ${this.region}'s bucket: ${inputs.bucket} ...`)

    const staticHostParams = {
      Bucket: inputs.bucket,
      Region: this.region,
      WebsiteConfiguration: {
        IndexDocument: {
          Suffix: inputs.code.index || 'index.html'
        },
        ErrorDocument: {
          Key: inputs.code.error || 'error.html'
        },
        RedirectAllRequestsTo: {
          Protocol: inputs.protocol || 'http'
        }
      }
    }

    if (inputs.cors && inputs.cors.length > 0) {
      await this.setAcl(inputs)
    }

    const setWebsiteHandler = util.promisify(this.cosClient.putBucketWebsite.bind(this.cosClient))
    try {
      await setWebsiteHandler(staticHostParams)
    } catch (e) {
      throw new Error(JSON.stringify(e))
    }
  }

  async getBucket(inputs = {}) {
    const getBucketHandler = util.promisify(this.cosClient.getBucket.bind(this.cosClient))
    try {
      return await getBucketHandler({
        Bucket: inputs.bucket,
        Region: this.region
      })
    } catch (e) {
      throw new Error(JSON.stringify(e))
    }
  }

  async upload(inputs = {}) {
    console.log(`Uploding files to ${this.region}'s bucket: ${inputs.bucket} ...`)

    const { bucket } = inputs
    const { region } = this

    if (!bucket) {
      throw Error('Could not find bucket name.')
    }

    // 上传分为文件夹上传呢和文件上传
    if (inputs.dir && (await fs.existsSync(inputs.dir))) {
      const options = { keyPrefix: inputs.keyPrefix }

      const items = await new Promise((resolve, reject) => {
        try {
          resolve(klawSync(inputs.dir))
        } catch (error) {
          reject(error)
        }
      })

      let handler
      let key
      const uploadItems = []
      items.forEach((item) => {
        // 如果是文件夹跳过
        if (item.stats.isDirectory()) {
          return
        }

        key = path.relative(inputs.dir, item.path)
        if (options.keyPrefix) {
          key = path.posix.join(options.keyPrefix, key)
        }

        if (path.sep === '\\') {
          key = key.replace(/\\/g, '/')
        }

        const itemParams = {
          Bucket: bucket,
          Region: region,
          Key: key,
          Body: fs.createReadStream(item.path)
        }
        handler = util.promisify(this.cosClient.putObject.bind(this.cosClient))
        uploadItems.push(handler(itemParams))
      })
      await Promise.all(uploadItems)
    } else if (inputs.file && (await fs.existsSync(inputs.file))) {
      const itemParams = {
        Bucket: bucket,
        Region: region,
        Key: inputs.key || path.basename(inputs.file),
        Body: fs.createReadStream(inputs.file)
      }
      const handler = util.promisify(this.cosClient.putObject.bind(this.cosClient))
      try {
        await handler(itemParams)
      } catch (e) {
        throw new Error(JSON.stringify(e))
      }
    }
  }

  async website(inputs = {}) {
    await this.createBucket({
      bucket: inputs.bucket,
      force: true
    })

    inputs.acl = {
      permissions: 'public-read',
      grantRead: '',
      grantWrite: '',
      grantFullControl: ''
    }
    await this.setAcl(inputs)

    await this.setWebsite(inputs)

    // 对cors进行额外处理
    if (inputs.cors) {
      await this.setCors(inputs)
    }

    // Build environment variables
    const envPath = inputs.code.envPath || inputs.code.root
    if (inputs.env && Object.keys(inputs.env).length && envPath) {
      let script = 'window.env = {};\n'
      inputs.env = inputs.env || {}
      for (const e in inputs.env) {
        script += `window.env.${e} = ${JSON.stringify(inputs.env[e])};\n`
      }
      const envFilePath = path.join(envPath, 'env.js')
      await fs.writeFileSync(envFilePath, script)
    }

    // If a hook is provided, build the website
    if (inputs.code.hook) {
      const options = { cwd: inputs.code.root }
      try {
        await exec(inputs.code.hook, options)
      } catch (err) {
        throw new Error(
          `Failed building website via "${inputs.code.hook}" due to the following error: "${err.stderr}"`
        )
      }
    }

    // upload
    const dirToUploadPath = inputs.code.src || inputs.code.root
    const uploadDict = {
      bucket: inputs.bucket
    }
    if (fs.lstatSync(dirToUploadPath).isDirectory()) {
      uploadDict.dir = dirToUploadPath
    } else {
      uploadDict.file = dirToUploadPath
    }
    await this.upload(uploadDict)

    return `${inputs.bucket}-${inputs.appid}.cos-website.${this.region}.myqcloud.com`
  }

  async deploy(inputs = {}) {
    await this.createBucket(inputs)
    if (inputs.acl) {
      await this.setAcl(inputs)
    }
    if (inputs.cors) {
      await this.setCors(inputs)
    } else {
      await this.deleteCors(inputs)
    }
    if (inputs.tags) {
      await this.setTags(inputs)
    } else {
      await this.deleteTags(inputs)
    }
    if (inputs.lifecycle) {
      await this.setLifecycle(inputs)
    } else {
      await this.deleteLifecycle(inputs)
    }
    if (inputs.versioning) {
      await this.setVersioning(inputs)
    }
    return inputs
  }

  async remove(inputs = {}) {
    console.log(`Removing bucket from ${this.region} ...`)

    // 获取全部文件
    const fileListResult = await this.getBucket(inputs)

    try {
      const fileList = []
      if (fileListResult && fileListResult.Contents && fileListResult.Contents.length > 0) {
        // delete files
        for (let i = 0; i < fileListResult.Contents.length; i++) {
          fileList.push({
            Key: fileListResult.Contents[i].Key
          })
        }
        const deleteMultipleObjectHandler = util.promisify(
          this.cosClient.deleteMultipleObject.bind(this.cosClient)
        )
        try {
          await deleteMultipleObjectHandler({
            Region: this.region,
            Bucket: inputs.bucket,
            Objects: fileList
          })
        } catch (e) {
          throw new Error(JSON.stringify(e))
        }
        const deleteBucketHandler = util.promisify(this.cosClient.deleteBucket.bind(this.cosClient))
        try {
          await deleteBucketHandler({
            Region: this.region,
            Bucket: inputs.bucket
          })
        } catch (e) {
          throw new Error(JSON.stringify(e))
        }
      }
    } catch (e) {
      throw new Error(JSON.stringify(e))
    }
  }
}

module.exports = Cos
