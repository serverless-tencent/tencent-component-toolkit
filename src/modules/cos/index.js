const COS = require('cos-nodejs-sdk-v5');
const path = require('path');
const fs = require('fs');
const { traverseDirSync } = require('../../utils');
const { TypeError, ApiError } = require('../../utils/error');

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
    this.cosClient = new COS(this.credentials);
  }

  promisify(callback) {
    return (params) => {
      return new Promise((resolve, reject) => {
        callback(params, (err, res) => {
          if (err) {
            if (typeof err.error === 'string') {
              reject(new Error(err.error));
            }
            const errMsg = err.error.Message
              ? `${err.error.Message} (reqId: ${err.error.RequestId})`
              : `${err.error}`;

            const e = new Error(errMsg);
            if (err.error && err.error.Code) {
              // Conflict request, just resolve
              if (err.error.Code === 'PathConflict') {
                resolve(true);
              }
              e.code = err.error.Code;
              e.reqId = err.error.RequestId;
            }
            reject(e);
          }
          resolve(res);
        });
      });
    };
  }

  async createBucket(inputs = {}) {
    console.log(`Creating bucket ${inputs.bucket}`);
    const createParams = {
      Bucket: inputs.bucket,
      Region: this.region,
    };
    const createHandler = this.promisify(this.cosClient.putBucket.bind(this.cosClient));
    try {
      await createHandler(createParams);
    } catch (e) {
      if (e.code === 'BucketAlreadyExists' || e.code === 'BucketAlreadyOwnedByYou') {
        if (!inputs.force) {
          throw new ApiError({
            type: `API_COS_putBucket`,
            message: e.message,
            stack: e.stack,
            reqId: e.reqId,
            code: e.code,
          });
        } else {
          console.log(`Bucket ${inputs.bucket} already exist.`);
        }
      } else {
        // TODO: cos在云函数中可能出现ECONNRESET错误，没办法具体定位，初步猜测是客户端问题，是函数启动网络还没准备好，这个还不确定，所以在这里做兼容
        if (e.message.includes('ECONNRESET')) {
          // 检查bucket是否存在
          const headHandler = this.promisify(this.cosClient.headBucket.bind(this.cosClient));
          try {
            const isHave = await headHandler(createParams);
            if (isHave.statusCode === 200) {
              if (!inputs.force) {
                throw new ApiError({
                  type: `API_COS_headBucket`,
                  message: `Bucket ${inputs.bucket} already exist`,
                });
              } else {
                console.log(`Bucket ${inputs.bucket} already exist`);
              }
            } else {
              throw new ApiError({
                type: `API_COS_headBucket`,
                message: `Could not find bucket ${inputs.bucket}`,
              });
            }
          } catch (err) {
            throw new ApiError({
              type: `API_COS_headBucket`,
              message: err.message,
              stack: err.stack,
              reqId: err.reqId,
              code: err.code,
            });
          }
        } else {
          throw new ApiError({
            type: `API_COS_putBucke`,
            message: e.message,
            stack: e.stack,
            reqId: e.reqId,
            code: e.code,
          });
        }
      }
    }
  }

  async setAcl(inputs = {}) {
    console.log(`Setting acl for bucket ${inputs.bucket}`);
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
      throw new ApiError({
        type: `API_COS_putBucketAcl`,
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  async setPolicy(inputs = {}) {
    console.log(`Setting policy for bucket ${inputs.bucket}`);
    const setPolicyParams = {
      Bucket: inputs.bucket,
      Region: this.region,
    };
    if (inputs.policy) {
      setPolicyParams.Policy = inputs.policy;
    }
    const setPolicyHandler = this.promisify(this.cosClient.putBucketPolicy.bind(this.cosClient));
    try {
      await setPolicyHandler(setPolicyParams);
    } catch (e) {
      throw new ApiError({
        type: `API_COS_putBucketPolicy`,
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  async setTags(inputs = {}) {
    console.log(`Setting tags for bucket ${inputs.bucket}`);
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
      throw new ApiError({
        type: `API_COS_putBucketTagging`,
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  async deleteTags(inputs = {}) {
    console.log(`Removing tags for bucket ${inputs.bucket}`);
    const deleteTagsHandler = this.promisify(
      this.cosClient.deleteBucketTagging.bind(this.cosClient),
    );
    try {
      await deleteTagsHandler({
        Bucket: inputs.bucket,
        Region: this.region,
      });
    } catch (e) {
      throw new ApiError({
        type: `API_COS_deleteBucketTagging`,
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  async setCors(inputs = {}) {
    console.log(`Setting lifecycle for bucket ${inputs.bucket}`);
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
      throw new ApiError({
        type: `API_COS_putBucketCors`,
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  async deleteCors(inputs = {}) {
    console.log(`Removing cors for bucket ${inputs.bucket}`);
    const deleteCorsHandler = this.promisify(this.cosClient.deleteBucketCors.bind(this.cosClient));
    try {
      await deleteCorsHandler({
        Bucket: inputs.bucket,
        Region: this.region,
      });
    } catch (e) {
      throw new ApiError({
        type: `API_COS_deleteBucketCors`,
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  async setLifecycle(inputs = {}) {
    console.log(`Setting lifecycle for bucket ${inputs.bucket}`);
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
      throw new ApiError({
        type: `API_COS_putBucketLifecycle`,
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  async deleteLifecycle(inputs = {}) {
    console.log(`Removing lifecycle for bucket ${inputs.bucket}`);
    const deleteLifecycle = this.promisify(
      this.cosClient.deleteBucketLifecycle.bind(this.cosClient),
    );
    try {
      await deleteLifecycle({
        Bucket: inputs.bucket,
        Region: this.region,
      });
    } catch (e) {
      throw new ApiError({
        type: `API_COS_deleteBucketLifecycle`,
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  async setVersioning(inputs = {}) {
    console.log(`Setting versioning for bucket ${inputs.bucket}`);

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
      throw new ApiError({
        type: `API_COS_putBucketVersioning`,
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  async setWebsite(inputs = {}) {
    console.log(`Setting Website for bucket ${inputs.bucket}`);

    const staticHostParams = {
      Bucket: inputs.bucket,
      Region: this.region,
      WebsiteConfiguration: {
        IndexDocument: {
          Suffix: inputs.code.index || 'index.html',
        },
        ErrorDocument: {
          Key: inputs.code.error || 'error.html',
          OriginalHttpStatus: inputs.disableErrorStatus === true ? 'Disabled' : 'Enabled',
        },
        RedirectAllRequestsTo: {
          Protocol: inputs.protocol || 'http',
        },
      },
    };

    const setWebsiteHandler = this.promisify(this.cosClient.putBucketWebsite.bind(this.cosClient));
    try {
      await setWebsiteHandler(staticHostParams);
    } catch (e) {
      throw new ApiError({
        type: `API_COS_putBucketWebsite`,
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
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
      throw new ApiError({
        type: `API_COS_getBucket`,
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
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
      throw new ApiError({
        type: `API_COS_getObjectUrl`,
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  async flushBucketFiles(bucket) {
    console.log(`Start to clear all files in bucket ${bucket}`);
    let detail;
    try {
      detail = await this.getBucket({
        bucket,
      });
    } catch (e) {
      if (e.code === 'NoSuchBucket') {
        console.log(`Bucket ${bucket} not exist`);
        return;
      }
    }

    if (detail) {
      if (detail.Contents && detail.Contents.length > 0) {
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
            Bucket: bucket,
            Objects: objectList,
          });
          console.log(`Clear all files in bucket ${bucket} success`);
        } catch (e) {
          console.log(e);
        }
      }
    }
  }

  async upload(inputs = {}) {
    const { bucket, replace } = inputs;
    const { region } = this;

    if (!bucket) {
      throw new TypeError(`PARAMETER_COS`, 'Bucket name is required');
    }

    if (replace) {
      await this.flushBucketFiles(bucket);
    }

    console.log(`Uploding files to bucket ${bucket}`);
    if (inputs.dir && (await fs.existsSync(inputs.dir))) {
      const options = { keyPrefix: inputs.keyPrefix };

      const items = await new Promise((resolve, reject) => {
        try {
          resolve(traverseDirSync(inputs.dir));
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
        throw new ApiError({
          type: `API_COS_putObject`,
          message: e.message,
          stack: e.stack,
          reqId: e.reqId,
          code: e.code,
        });
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
        throw new ApiError({
          type: `API_COS_putObject`,
          message: e.message,
          stack: e.stack,
          reqId: e.reqId,
          code: e.code,
        });
      }
    }
  }

  async website(inputs = {}) {
    await this.createBucket({
      bucket: inputs.bucket,
      force: true,
    });

    if (inputs.acl) {
      await this.setAcl(inputs);
    }

    if (inputs.policy) {
      await this.setPolicy(inputs);
    }

    await this.setWebsite(inputs);

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

    // upload
    const dirToUploadPath = inputs.code.src || inputs.code.root;
    const uploadDict = {
      bucket: inputs.bucket,
      replace: inputs.replace,
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
    if (inputs.policy) {
      await this.setPolicy(inputs);
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
        replace: inputs.replace,
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
    console.log(`Removing bucket ${inputs.bucket}`);

    let detail;
    try {
      detail = await this.getBucket(inputs);
    } catch (e) {
      if (e.code === 'NoSuchBucket') {
        console.log(`Bucket ${inputs.bucket} not exist`);
        return;
      }
    }

    // if bucket exist, begain to delate
    if (detail) {
      try {
        // 1. flush all files
        await this.flushBucketFiles(inputs.bucket);

        // 2. delete bucket
        const deleteBucketHandler = this.promisify(
          this.cosClient.deleteBucket.bind(this.cosClient),
        );
        await deleteBucketHandler({
          Region: this.region,
          Bucket: inputs.bucket,
        });
        console.log(`Remove bucket ${inputs.bucket} success`);
      } catch (e) {
        // why do this judgement again
        // because when requesting to delete, bucket may be deleted even though it exist before.
        if (e.code === 'NoSuchBucket') {
          console.log(`Bucket ${inputs.bucket} not exist`);
        } else {
          throw new ApiError({
            type: `API_APIGW_deleteBucket`,
            message: e.message,
            stack: e.stack,
            reqId: e.reqId,
            code: e.code,
          });
        }
      }
    }
  }
}

module.exports = Cos;
