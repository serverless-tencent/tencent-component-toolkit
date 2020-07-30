const { cos } = require('tencent-cloud-sdk');
const util = require('util');
const path = require('path');
const fs = require('fs');
const klawSync = require('klaw-sync');
const exec = util.promisify(require('child_process').exec);
const { TypeError } = require('../../utils/error');

class Cos {
  constructor(credentials = {}, region = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;
    // cos临时密钥需要用XCosSecurityToken
    if (credentials.token) {
      this.credentials.XCosSecurityToken = credentials.token;
    }
    if (credentials.Token) {
      this.credentials.XCosSecurityToken = credentials.Token;
    }
    this.cosClient = new cos(this.credentials);
  }

  promisify(callback) {
    return (params) => {
      return new Promise((resolve, reject) => {
        callback(params, (err, res) => {
          if (err) {
            const e = new Error(
              typeof err.error === 'string' ? err.error : `${err.error.Code}: ${err.error.Message}`,
            );
            if (err.error && err.error.Code) {
              // Conflict request, just resolve
              if (err.error.Code === 'PathConflict') {
                resolve(true);
              }
              e.code = err.error.Code;
              e.requestId = err.error.RequestId;
              e.traceId = err.error.TraceId;
            }
            reject(e);
          }
          resolve(res);
        });
      });
    };
  }

  async createBucket(inputs = {}) {
    console.log(`Creating bucket: ${inputs.bucket} in ${this.region}  ...`);
    const createParams = {
      Bucket: inputs.bucket,
      Region: this.region,
    };
    const createHandler = this.promisify(this.cosClient.putBucket.bind(this.cosClient));
    try {
      await createHandler(createParams);
    } catch (e) {
      if (e.code == 'BucketAlreadyExists' || e.code == 'BucketAlreadyOwnedByYou') {
        if (!inputs.force) {
          throw new TypeError(`API_COS_putBucket`, JSON.stringify(e), e.stack);
        } else {
          console.log(`Bucket ${inputs.bucket} already exist.`);
        }
      } else {
        // TODO: cos在云函数中可能出现ECONNRESET错误，没办法具体定位，初步猜测是客户端问题，是函数启动网络还没准备好，这个还不确定，所以在这里做兼容
        if (JSON.stringify(e).includes('ECONNRESET')) {
          // 检查bucket是否存在
          const headHandler = this.promisify(this.cosClient.headBucket.bind(this.cosClient));
          try {
            const isHave = await headHandler(createParams);
            if (isHave.statusCode == 200) {
              if (!inputs.force) {
                throw new TypeError(
                  `API_COS_headBucket`,
                  'BucketAlreadyExists and BucketAlreadyOwnedByYou',
                );
              } else {
                console.log(`Bucket ${inputs.bucket} already exist.`);
              }
            } else {
              throw new TypeError(`API_COS_headBucket`, 'Could not find this bucket');
            }
          } catch (err) {
            throw new TypeError(`API_COS_headBucket`, JSON.stringify(err), err.stack);
          }
        } else {
          throw new TypeError(`API_COS_putBucket`, JSON.stringify(e), e.stack);
        }
      }
    }
  }

  async setAcl(inputs = {}) {
    console.log(`Setting acl for ${this.region}'s bucket: ${inputs.bucket} ...`);
    const setAclParams = {
      Bucket: inputs.bucket,
      Region: this.region,
    };
    if (inputs.acl.permissions) {
      setAclParams.ACL = inputs.acl.permissions;
    }
    if (inputs.acl.grantRead) {
      setAclParams.GrantRead = inputs.acl.grantRead;
    }
    if (inputs.acl.grantWrite) {
      setAclParams.GrantWrite = inputs.acl.grantWrite;
    }
    if (inputs.acl.grantReadAcp) {
      setAclParams.GrantReadAcp = inputs.acl.grantReadAcp;
    }
    if (inputs.acl.grantWriteAcp) {
      setAclParams.GrantWriteAcp = inputs.acl.grantWriteAcp;
    }
    if (inputs.acl.grantFullControl) {
      setAclParams.GrantFullControl = inputs.acl.grantFullControl;
    }
    if (inputs.acl.accessControlPolicy) {
      const accessControlPolicy = {};
      if (inputs.acl.accessControlPolicy.owner && inputs.acl.accessControlPolicy.owner.id) {
        accessControlPolicy.Owner = {
          ID: inputs.acl.accessControlPolicy.owner.id,
        };
      }
      if (inputs.acl.accessControlPolicy.grants) {
        accessControlPolicy.Grants = {};
        if (inputs.acl.accessControlPolicy.grants.permission) {
          accessControlPolicy.Grants.Permission = inputs.acl.accessControlPolicy.grants.permission;
        }
        if (inputs.acl.accessControlPolicy.grants.grantee) {
          accessControlPolicy.Grants.Grantee = {};
          if (inputs.acl.accessControlPolicy.grants.grantee.id) {
            accessControlPolicy.Grants.Grantee.ID =
              inputs.acl.accessControlPolicy.grants.grantee.id;
          }
          if (inputs.acl.accessControlPolicy.grants.grantee.displayName) {
            accessControlPolicy.Grants.Grantee.DisplayName =
              inputs.acl.accessControlPolicy.grants.grantee.displayName;
          }
          if (inputs.acl.accessControlPolicy.grants.grantee.uri) {
            accessControlPolicy.Grants.Grantee.URI =
              inputs.acl.accessControlPolicy.grants.grantee.uri;
          }
        }
      }
      setAclParams.AccessControlPolicy = accessControlPolicy;
    }
    const setAclHandler = this.promisify(this.cosClient.putBucketAcl.bind(this.cosClient));
    try {
      await setAclHandler(setAclParams);
    } catch (e) {
      throw new TypeError(`API_COS_putBucketAcl`, JSON.stringify(e), e.stack);
    }
  }

  async setTags(inputs = {}) {
    console.log(`Setting tags for ${this.region}'s bucket: ${inputs.bucket} ...`);
    const tags = [];
    for (let i = 0; i < inputs.tags.length; i++) {
      tags.push({
        Key: inputs.tags[i].key,
        Value: inputs.tags[i].value,
      });
    }
    const setTagsParams = {
      Bucket: inputs.bucket,
      Region: this.region,
      Tagging: {
        Tags: tags,
      },
    };
    const setTagsHandler = this.promisify(this.cosClient.putBucketTagging.bind(this.cosClient));
    try {
      await setTagsHandler(setTagsParams);
    } catch (e) {
      throw new TypeError(`API_COS_putBucketTagging`, e.message, e.stack);
    }
  }

  async deleteTags(inputs = {}) {
    console.log(`Removing tags for ${this.region}'s bucket: ${inputs.bucket} ...`);
    const deleteTagsHandler = this.promisify(
      this.cosClient.deleteBucketTagging.bind(this.cosClient),
    );
    try {
      await deleteTagsHandler({
        Bucket: inputs.bucket,
        Region: this.region,
      });
    } catch (e) {
      throw new TypeError(`API_COS_deleteBucketTagging`, e.message, e.stack);
    }
  }

  async setCors(inputs = {}) {
    console.log(`Setting lifecycle for ${this.region}'s bucket: ${inputs.bucket} ...`);
    const cors = [];
    for (let i = 0; i < inputs.cors.length; i++) {
      const tempCors = {
        AllowedMethods: inputs.cors[i].allowedMethods,
        AllowedOrigins: inputs.cors[i].allowedOrigins,
      };
      if (inputs.cors[i].maxAgeSeconds) {
        tempCors.MaxAgeSeconds = String(inputs.cors[i].maxAgeSeconds);
      }
      if (inputs.cors[i].id) {
        tempCors.ID = inputs.cors[i].id;
      }
      if (inputs.cors[i].allowedHeaders) {
        tempCors.AllowedHeaders = inputs.cors[i].allowedHeaders;
      }
      if (inputs.cors[i].exposeHeaders) {
        tempCors.ExposeHeaders = inputs.cors[i].exposeHeaders;
      }
      cors.push(tempCors);
    }
    const setCorsParams = {
      Bucket: inputs.bucket,
      Region: this.region,
      CORSRules: cors,
    };
    const setCorsHandler = this.promisify(this.cosClient.putBucketCors.bind(this.cosClient));
    try {
      await setCorsHandler(setCorsParams);
    } catch (e) {
      throw new TypeError(`API_COS_putBucketCors`, e.message, e.stack);
    }
  }

  async deleteCors(inputs = {}) {
    console.log(`Removing cors for ${this.region}'s bucket: ${inputs.bucket} ...`);
    const deleteCorsHandler = this.promisify(this.cosClient.deleteBucketCors.bind(this.cosClient));
    try {
      await deleteCorsHandler({
        Bucket: inputs.bucket,
        Region: this.region,
      });
    } catch (e) {
      throw new TypeError(`API_COS_deleteBucketCors`, e.message, e.stack);
    }
  }

  async setLifecycle(inputs = {}) {
    console.log(`Setting lifecycle for ${this.region}'s bucket: ${inputs.bucket} ...`);
    const lifecycle = [];
    for (let i = 0; i < inputs.lifecycle.length; i++) {
      const tempLifecycle = {
        ID: inputs.lifecycle[i].id,
        Status: inputs.lifecycle[i].status,
        Filter: {},
      };
      if (inputs.lifecycle[i].filter && inputs.lifecycle[i].filter.prefix) {
        tempLifecycle.Filter.Prefix = inputs.lifecycle[i].filter.prefix;
      }
      if (inputs.lifecycle[i].transition) {
        tempLifecycle.Transition = {
          Days: Number(inputs.lifecycle[i].transition.days),
        };
        if (inputs.lifecycle[i].transition.storageClass) {
          tempLifecycle.Transition.StorageClass = inputs.lifecycle[i].transition.storageClass;
        }
      }
      if (inputs.lifecycle[i].noncurrentVersionTransition) {
        tempLifecycle.NoncurrentVersionTransition = {
          NoncurrentDays: Number(inputs.lifecycle[i].NoncurrentVersionTransition.noncurrentDays),
          StorageClass: inputs.lifecycle[i].NoncurrentVersionTransition.storageClass,
        };
      }
      if (inputs.lifecycle[i].expiration) {
        tempLifecycle.Expiration = {
          Days: Number(inputs.lifecycle[i].expiration.days),
          ExpiredObjectDeleteMarker: inputs.lifecycle[i].expiration.expiredObjectDeleteMarker,
        };
      }
      if (inputs.lifecycle[i].abortIncompleteMultipartUpload) {
        tempLifecycle.AbortIncompleteMultipartUpload = {
          DaysAfterInitiation: Number(
            inputs.lifecycle[i].abortIncompleteMultipartUpload.daysAfterInitiation,
          ),
        };
      }
      lifecycle.push(tempLifecycle);
    }
    const setLifecycleParams = {
      Bucket: inputs.bucket,
      Region: this.region,
      Rules: lifecycle,
    };
    const setLifecycleHandler = this.promisify(
      this.cosClient.putBucketLifecycle.bind(this.cosClient),
    );
    try {
      await setLifecycleHandler(JSON.parse(JSON.stringify(setLifecycleParams)));
    } catch (e) {
      throw new TypeError(`API_COS_putBucketLifecycle`, e.message, e.stack);
    }
  }

  async deleteLifecycle(inputs = {}) {
    console.log(`Removing lifecycle for ${this.region}'s bucket: ${inputs.bucket} ...`);
    const deleteLifecycle = this.promisify(
      this.cosClient.deleteBucketLifecycle.bind(this.cosClient),
    );
    try {
      await deleteLifecycle({
        Bucket: inputs.bucket,
        Region: this.region,
      });
    } catch (e) {
      throw new TypeError(`API_COS_deleteBucketLifecycle`, e.message, e.stack);
    }
  }

  async setVersioning(inputs = {}) {
    console.log(`Setting versioning for ${this.region}'s bucket: ${inputs.bucket} ...`);

    const setVersioningParams = {
      Bucket: inputs.bucket,
      Region: this.region,
      VersioningConfiguration: {
        Status: inputs.versioning,
      },
    };
    const setVersioningHandler = this.promisify(
      this.cosClient.putBucketVersioning.bind(this.cosClient),
    );
    try {
      await setVersioningHandler(setVersioningParams);
    } catch (e) {
      throw new TypeError(`API_COS_putBucketVersioning`, e.message, e.stack);
    }
  }

  async setWebsite(inputs = {}) {
    console.log(`Setting Website for ${this.region}'s bucket: ${inputs.bucket} ...`);

    const staticHostParams = {
      Bucket: inputs.bucket,
      Region: this.region,
      WebsiteConfiguration: {
        IndexDocument: {
          Suffix: inputs.code.index || 'index.html',
        },
        ErrorDocument: {
          Key: inputs.code.error || 'error.html',
        },
        RedirectAllRequestsTo: {
          Protocol: inputs.protocol || 'http',
        },
      },
    };

    if (inputs.cors && inputs.cors.length > 0) {
      await this.setAcl(inputs);
    }

    const setWebsiteHandler = this.promisify(this.cosClient.putBucketWebsite.bind(this.cosClient));
    try {
      await setWebsiteHandler(staticHostParams);
    } catch (e) {
      throw new TypeError(`API_COS_putBucketWebsite`, e.message, e.stack);
    }
  }

  async getBucket(inputs = {}) {
    const getBucketHandler = this.promisify(this.cosClient.getBucket.bind(this.cosClient));
    try {
      const res = await getBucketHandler({
        Bucket: inputs.bucket,
        Region: this.region,
      });
      return res;
    } catch (e) {
      throw new TypeError(`API_COS_getBucket`, e.message, e.stack);
    }
  }

  async getObjectUrl(inputs = {}) {
    const getObjectUrlHandler = this.promisify(this.cosClient.getObjectUrl.bind(this.cosClient));
    try {
      const { Url } = await getObjectUrlHandler({
        Bucket: inputs.bucket,
        Region: this.region,
        Key: inputs.object,
        // default request method is GET
        Method: inputs.method || 'GET',
        // default expire time is 15min
        Expires: inputs.expires || 900,
        // default is sign url
        Sign: inputs.sign === false ? false : true,
      });
      return Url;
    } catch (e) {
      throw new TypeError(`API_COS_getObjectUrl`, e.message, e.stack);
    }
  }

  async upload(inputs = {}) {
    const { bucket } = inputs;
    const { region } = this;

    if (!bucket) {
      throw new TypeError(`PARAMETER_COS`, 'Bucket name is required');
    }

    console.log(`Uploding files to ${this.region}'s bucket: ${inputs.bucket} ...`);
    if (inputs.dir && (await fs.existsSync(inputs.dir))) {
      const options = { keyPrefix: inputs.keyPrefix };

      const items = await new Promise((resolve, reject) => {
        try {
          resolve(klawSync(inputs.dir));
        } catch (error) {
          reject(error);
        }
      });

      let handler;
      let key;
      const uploadItems = [];
      items.forEach((item) => {
        // 如果是文件夹跳过
        if (item.stats.isDirectory()) {
          return;
        }

        key = path.relative(inputs.dir, item.path);
        if (options.keyPrefix) {
          key = path.posix.join(options.keyPrefix, key);
        }

        if (path.sep === '\\') {
          key = key.replace(/\\/g, '/');
        }

        const itemParams = {
          Bucket: bucket,
          Region: region,
          Key: key,
          Body: fs.createReadStream(item.path),
        };
        handler = this.promisify(this.cosClient.putObject.bind(this.cosClient));
        uploadItems.push(handler(itemParams));
      });
      try {
        await Promise.all(uploadItems);
      } catch (e) {
        throw new TypeError(`API_COS_putObject`, e.message, e.stack);
      }
    } else if (inputs.file && (await fs.existsSync(inputs.file))) {
      const itemParams = {
        Bucket: bucket,
        Region: region,
        Key: inputs.key || path.basename(inputs.file),
        Body: fs.createReadStream(inputs.file),
      };
      const handler = this.promisify(this.cosClient.putObject.bind(this.cosClient));
      try {
        await handler(itemParams);
      } catch (e) {
        throw new TypeError(`API_COS_putObject`, e.message, e.stack);
      }
    }
  }

  async website(inputs = {}) {
    await this.createBucket({
      bucket: inputs.bucket,
      force: true,
    });

    inputs.acl = {
      permissions: 'public-read',
      grantRead: '',
      grantWrite: '',
      grantFullControl: '',
    };
    await this.setAcl(inputs);

    await this.setWebsite(inputs);

    // 对cors进行额外处理
    if (inputs.cors) {
      await this.setCors(inputs);
    }

    // Build environment variables
    const envPath = inputs.code.envPath || inputs.code.root;
    if (inputs.env && Object.keys(inputs.env).length && envPath) {
      let script = 'window.env = {};\n';
      inputs.env = inputs.env || {};
      for (const e in inputs.env) {
        script += `window.env.${e} = ${JSON.stringify(inputs.env[e])};\n`;
      }
      const envFilePath = path.join(envPath, 'env.js');
      try {
        await fs.writeFileSync(envFilePath, script);
      } catch (e) {
        throw new TypeError(`DEPLOY_COS_CREATE_ENV_FILE`, e.message, e.stack);
      }
    }

    // If a hook is provided, build the website
    if (inputs.code.hook) {
      const options = { cwd: inputs.code.root };
      try {
        await exec(inputs.code.hook, options);
      } catch (err) {
        throw new TypeError(
          `DEPLOY_COS_EXEC_HOOK`,
          `Failed building website via "${inputs.code.hook}" due to the following error: "${err.stderr}"`,
          err.stack,
        );
      }
    }

    // upload
    const dirToUploadPath = inputs.code.src || inputs.code.root;
    const uploadDict = {
      bucket: inputs.bucket,
    };
    if (fs.lstatSync(dirToUploadPath).isDirectory()) {
      uploadDict.dir = dirToUploadPath;
    } else {
      uploadDict.file = dirToUploadPath;
    }
    await this.upload(uploadDict);

    return `${inputs.bucket}.cos-website.${this.region}.myqcloud.com`;
  }

  async deploy(inputs = {}) {
    await this.createBucket(inputs);
    if (inputs.acl) {
      await this.setAcl(inputs);
    }
    if (inputs.cors) {
      await this.setCors(inputs);
    } else {
      await this.deleteCors(inputs);
    }
    if (inputs.tags) {
      await this.setTags(inputs);
    } else {
      await this.deleteTags(inputs);
    }
    if (inputs.lifecycle) {
      await this.setLifecycle(inputs);
    } else {
      await this.deleteLifecycle(inputs);
    }
    if (inputs.versioning) {
      await this.setVersioning(inputs);
    }
    if (inputs.src) {
      // upload
      const dirToUploadPath = inputs.src;
      const uploadDict = {
        bucket: inputs.bucket,
        keyPrefix: inputs.keyPrefix || '/',
      };

      if (fs.lstatSync(dirToUploadPath).isDirectory()) {
        uploadDict.dir = dirToUploadPath;
      } else {
        uploadDict.file = dirToUploadPath;
      }
      await this.upload(uploadDict);
    }
    return inputs;
  }

  async remove(inputs = {}) {
    console.log(`Removing bucket from ${this.region} ...`);

    // 获取全部文件
    let detail;
    try {
      detail = await this.getBucket(inputs);
    } catch (e) {
      if (e.message.indexOf('NoSuchBucket') !== -1) {
        console.log(`Bucket ${inputs.bucket} not exist`);
        return;
      }
    }

    if (detail && detail.Contents) {
      // delete files
      const objectList = (detail.Contents || []).map((item) => {
        return {
          Key: item.Key,
        };
      });

      try {
        const deleteMultipleObjectHandler = this.promisify(
          this.cosClient.deleteMultipleObject.bind(this.cosClient),
        );
        await deleteMultipleObjectHandler({
          Region: this.region,
          Bucket: inputs.bucket,
          Objects: objectList,
        });
      } catch (e) {
        console.log(e);
      }
      try {
        const deleteBucketHandler = this.promisify(
          this.cosClient.deleteBucket.bind(this.cosClient),
        );
        await deleteBucketHandler({
          Region: this.region,
          Bucket: inputs.bucket,
        });
      } catch (e) {
        if (e.message.indexOf('NoSuchBucket') !== -1) {
          console.log(`Bucket ${inputs.bucket} not exist`);
        } else {
          throw new TypeError(`API_APIGW_deleteBucket`, e.message, e.stack);
        }
      }
    }
  }
}

module.exports = Cos;
