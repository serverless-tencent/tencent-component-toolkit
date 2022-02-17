import { RegionType, CapiCredentials } from './../interface';
import COS, {
  CORSRule,
  CosSdkError,
  LifecycleRule,
  PutBucketAclParams,
  PutBucketCorsParams,
  PutBucketLifecycleParams,
  PutBucketPolicyParams,
  PutBucketTaggingParams,
  PutBucketVersioningParams,
  PutBucketWebsiteParams,
  PutObjectResult,
  WebsiteConfiguration,
} from 'cos-nodejs-sdk-v5';
import path from 'path';
import {
  CosCreateBucketInputs,
  CosSetAclInputs,
  CosSetPolicyInputs,
  CosSetTagInputs,
  CosDeleteTagsInputs,
  CosSetCorsInputs,
  CosDeleteCorsInputs,
  CosSetLifecycleInputs,
  CosDeleteLifecycleInputs,
  CosRemoveBucketInputs,
  CosWebsiteInputs,
  CosDeployInputs,
  CosSetVersioningInputs,
  CosSetWebsiteInputs,
  CosGetBucketInputs,
  CosGetObjectUrlInputs,
  CosUploadInputs,
} from './interface';
import fs from 'fs';
import { traverseDirSync } from '../../utils';
import { ApiTypeError, ApiError } from '../../utils/error';

export interface CosInsideError {
  Code: string;
  Message: string;
  RequestId?: string;
  Resource?: string;
  TraceId?: string;
}

/** 将 Cos error 转为统一的形式 */
export function convertCosError(err: CosSdkError) {
  let { code } = err;
  const reqId = err?.headers && err?.headers['x-cos-request-id'];
  const traceId = err?.headers && err?.headers['x-cos-trace-id'];
  const msgSuffix = reqId ? ` (reqId: ${reqId}${traceId ? `, traceId: ${traceId}` : ''})` : '';
  if (typeof err.error === 'string') {
    return {
      code,
      message: `${err.message ?? err.error}`,
      reqId,
    };
  }
  const error = err.error as CosInsideError;
  code = error?.Code || err.code;
  const message = `${error?.Message || err.message}${msgSuffix}`;
  return {
    code,
    message: `${message}`,
    reqId,
  };
}

function constructCosError(type: string, err: CosSdkError) {
  const e = convertCosError(err);
  return new ApiError({ type, ...e });
}

export default class Cos {
  credentials: CapiCredentials;
  region: RegionType;
  cosClient: COS;
  retryTimes: number;
  maxRetryTimes: number;

  constructor(credentials: CapiCredentials = {}, region: RegionType = 'ap-guangzhou') {
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

    // 支持 CreateBucket 重试一次
    this.retryTimes = 0;
    this.maxRetryTimes = 1;
  }

  async isBucketExist(bucket: string) {
    try {
      const isHave = await this.cosClient.headBucket({
        Bucket: bucket,
        Region: this.region,
      });
      return isHave.statusCode === 200;
    } catch (e) {
      return false;
    }
  }

  async createBucket(inputs: CosCreateBucketInputs = {}) {
    // TODO: HeadBucket 请求如果 404 COS 会缓存，暂时不能使用，只能直接调用 CreateBucket
    // const exist = await this.isBucketExist(inputs.bucket!);
    // if (exist) {
    //   return true;
    // }
    if (this.retryTimes === 0) {
      console.log(`Creating bucket ${inputs.bucket}`);
    }
    const createParams = {
      Bucket: inputs.bucket!,
      Region: this.region,
    };

    try {
      await this.cosClient.putBucket(createParams);
      this.retryTimes = 0;
    } catch (err) {
      const e = convertCosError(err);
      if (e.code === 'BucketAlreadyExists' || e.code === 'BucketAlreadyOwnedByYou') {
        console.log(`Bucket ${inputs.bucket} already exist.`);
      } else if (e.code === 'TooManyBuckets') {
        // 存储桶太多了，就先查看是否存在，如果不存在再抛出错误
        const exist = await this.isBucketExist(inputs.bucket!);
        if (exist) {
          console.log(`Bucket ${inputs.bucket} already exist.`);
          return true;
        }
        throw constructCosError(`API_COS_putBucket`, err);
      } else {
        // 失败重试 1 次，如果再次出错，正常处理
        if (this.retryTimes < this.maxRetryTimes) {
          this.retryTimes++;
          await this.createBucket(inputs);
        } else {
          this.retryTimes = 0;
          throw constructCosError(`API_COS_putBucket`, err);
        }
      }
    }
  }

  async setAcl(inputs: CosSetAclInputs = {}) {
    console.log(`Setting acl for bucket ${inputs.bucket}`);
    const setAclParams: PutBucketAclParams = {
      Bucket: inputs.bucket!,
      Region: this.region,
    };

    if (inputs.acl) {
      setAclParams.ACL = inputs.acl?.permissions;
      setAclParams.GrantRead = inputs.acl?.grantRead;
      setAclParams.GrantWrite = inputs.acl?.grantWrite;

      setAclParams.GrantReadAcp = inputs.acl?.grantReadAcp;
      setAclParams.GrantWriteAcp = inputs.acl?.grantWriteAcp;
      setAclParams.GrantFullControl = inputs.acl?.grantFullControl;
    }

    if (inputs.acl?.accessControlPolicy) {
      const acp = inputs.acl?.accessControlPolicy;
      const accessControlPolicy: Exclude<typeof setAclParams.AccessControlPolicy, undefined> = {
        Owner: {
          ID: acp?.owner?.id!,
        },
        Grants: [
          {
            Permission: acp?.grants?.permission!,
            // FIXME: dont have URI
            Grantee: {
              ID: acp?.grants?.grantee?.id!,
            },
          },
        ],
      };
      setAclParams.AccessControlPolicy = accessControlPolicy;
    }
    try {
      await this.cosClient.putBucketAcl(setAclParams);
    } catch (err) {
      throw constructCosError(`API_COS_putBucketAcl`, err);
    }
  }

  async setPolicy(inputs: CosSetPolicyInputs = {}) {
    console.log(`Setting policy for bucket ${inputs.bucket}`);
    const setPolicyParams: PutBucketPolicyParams = {
      Policy: inputs.policy!,
      Bucket: inputs.bucket!,
      Region: this.region,
    };

    try {
      await this.cosClient.putBucketPolicy(setPolicyParams);
    } catch (err) {
      throw constructCosError(`API_COS_putBucketPolicy`, err);
    }
  }

  async setTags(inputs: CosSetTagInputs = {}) {
    console.log(`Setting tags for bucket ${inputs.bucket}`);

    const tags = inputs.tags?.map((item) => {
      return {
        Key: item.key,
        Value: item.value,
      };
    });

    const setTagsParams: PutBucketTaggingParams = {
      Bucket: inputs.bucket!,
      Region: this.region,
      // FIXME: mismatch type
      // Tagging: {
      //   Tags: tags,
      // },
      Tags: tags!,
    };

    try {
      await this.cosClient.putBucketTagging(setTagsParams);
    } catch (err) {
      throw constructCosError(`API_COS_putBucketTagging`, err);
    }
  }

  async deleteTags(inputs: CosDeleteTagsInputs = {}) {
    console.log(`Removing tags for bucket ${inputs.bucket}`);
    try {
      await this.cosClient.deleteBucketTagging({
        Bucket: inputs.bucket!,
        Region: this.region,
      });
    } catch (err) {
      throw constructCosError(`API_COS_deleteBucketTagging`, err);
    }
  }

  async setCors(inputs: CosSetCorsInputs = {}) {
    console.log(`Setting lifecycle for bucket ${inputs.bucket}`);
    const cors: CORSRule[] = [];

    if (inputs.cors) {
      for (let i = 0; i < inputs.cors?.length; i++) {
        // FIXME: mismatch typing
        const tempCors: CORSRule = {
          // AllowedMethods: inputs.cors[i].allowedMethods,
          // AllowedOrigins: inputs.cors[i].allowedOrigins,
          AllowedMethod: inputs.cors[i].allowedMethods,
          AllowedOrigin: inputs.cors[i].allowedOrigins,
        };

        // FIXME:
        tempCors.MaxAgeSeconds = Number(inputs.cors[i].maxAgeSeconds);
        // tempCors.ID = inputs.cors[i].id;
        // tempCors.AllowedHeaders = inputs.cors[i].allowedHeaders;
        // tempCors.ExposeHeaders = inputs.cors[i].exposeHeaders;
        tempCors.AllowedHeader = inputs.cors[i].allowedHeaders;
        tempCors.ExposeHeader = inputs.cors[i].exposeHeaders;

        cors.push(tempCors);
      }
    }
    const setCorsParams: PutBucketCorsParams = {
      Bucket: inputs.bucket!,
      Region: this.region,
      CORSRules: cors,
    };

    try {
      await this.cosClient.putBucketCors(setCorsParams);
    } catch (err) {
      throw constructCosError(`API_COS_putBucketCors`, err);
    }
  }

  async deleteCors(inputs: CosDeleteCorsInputs = {}) {
    console.log(`Removing cors for bucket ${inputs.bucket}`);
    try {
      await this.cosClient.deleteBucketCors({
        Bucket: inputs.bucket!,
        Region: this.region,
      });
    } catch (err) {
      throw constructCosError(`API_COS_deleteBucketCors`, err);
    }
  }

  async setLifecycle(inputs: CosSetLifecycleInputs = {}) {
    console.log(`Setting lifecycle for bucket ${inputs.bucket}`);
    const rules = [];

    if (inputs.lifecycle) {
      for (let i = 0; i < inputs.lifecycle.length; i++) {
        const lc = inputs.lifecycle[i];
        const tempLifecycle: LifecycleRule = {
          ID: lc.id,
          Status: lc.status,
          Filter: {},
        };

        if (typeof lc.filter !== 'string' && lc.filter?.prefix) {
          tempLifecycle.Filter = {
            Prefix: lc.filter?.prefix,
          };
        }

        if (lc.transition) {
          tempLifecycle.Transition = {
            Days: Number(lc.transition.days),
            StorageClass: lc.transition.storageClass,
          };
        }

        if (lc.NoncurrentVersionTransition) {
          tempLifecycle.NoncurrentVersionTransition = {
            NoncurrentDays: Number(lc.NoncurrentVersionTransition.noncurrentDays),
            StorageClass: lc.NoncurrentVersionTransition.storageClass,
          };
        }
        if (lc.expiration) {
          tempLifecycle.Expiration = {
            Days: Number(lc.expiration.days),
            ExpiredObjectDeleteMarker: lc.expiration.expiredObjectDeleteMarker,
          };
        }
        if (lc.abortIncompleteMultipartUpload) {
          tempLifecycle.AbortIncompleteMultipartUpload = {
            DaysAfterInitiation: Number(lc.abortIncompleteMultipartUpload.daysAfterInitiation),
          };
        }
        rules.push(tempLifecycle);
      }
    }
    const setLifecycleParams: PutBucketLifecycleParams = {
      Bucket: inputs.bucket!,
      Region: this.region,
      Rules: rules,
    };

    try {
      await this.cosClient.putBucketLifecycle(JSON.parse(JSON.stringify(setLifecycleParams)));
    } catch (err) {
      throw constructCosError(`API_COS_putBucketLifecycle`, err);
    }
  }

  async deleteLifecycle(inputs: CosDeleteLifecycleInputs = {}) {
    console.log(`Removing lifecycle for bucket ${inputs.bucket}`);
    try {
      await this.cosClient.deleteBucketLifecycle({
        Bucket: inputs.bucket!,
        Region: this.region,
      });
    } catch (err) {
      throw constructCosError(`API_COS_deleteBucketLifecycle`, err);
    }
  }

  async setVersioning(inputs: CosSetVersioningInputs = {}) {
    console.log(`Setting versioning for bucket ${inputs.bucket}`);

    const setVersioningParams: PutBucketVersioningParams = {
      Bucket: inputs.bucket!,
      Region: this.region,
      VersioningConfiguration: {
        Status: inputs.versioning as 'Enabled' | 'Suspended',
      },
    };
    try {
      await this.cosClient.putBucketVersioning(setVersioningParams);
    } catch (err) {
      throw constructCosError(`API_COS_putBucketVersioning`, err);
    }
  }

  async setWebsite(inputs: CosSetWebsiteInputs = {}) {
    console.log(`Setting Website for bucket ${inputs.bucket}`);

    const websiteConfig: WebsiteConfiguration = {
      IndexDocument: {
        Suffix: inputs.code?.index ?? 'index.html',
      },
      ErrorDocument: {
        Key: inputs.code?.error ?? 'error.html',
        // FIXME: cors "Enabled" type error
        OriginalHttpStatus: inputs.disableErrorStatus === true ? 'Disabled' : ('Enabled' as any),
      },
      RedirectAllRequestsTo: {
        Protocol: inputs.protocol ?? 'http',
      },
      AutoAddressing: {
        Status: inputs.ignoreHtmlExt ? 'Enabled' : 'Disabled',
      },
    };

    // 支持重定向规则配置
    // 参考：https://cloud.tencent.com/document/product/436/31930
    if (inputs.redirectRules) {
      websiteConfig.RoutingRules = inputs.redirectRules;
    }

    const staticHostParams: PutBucketWebsiteParams = {
      Bucket: inputs.bucket!,
      Region: this.region,
      WebsiteConfiguration: websiteConfig,
    };

    try {
      await this.cosClient.putBucketWebsite(staticHostParams);
    } catch (err) {
      throw constructCosError(`API_COS_putBucketWebsite`, err);
    }
  }

  async getBucket(inputs: CosGetBucketInputs = {}) {
    try {
      const res = await this.cosClient.getBucket({
        Bucket: inputs.bucket!,
        Region: this.region,
      });
      return res;
    } catch (err) {
      throw constructCosError(`API_COS_getBucket`, err);
    }
  }

  async getObjectUrl(inputs: CosGetObjectUrlInputs = {}) {
    return new Promise((resolve, reject) => {
      this.cosClient.getObjectUrl(
        {
          Bucket: inputs.bucket!,
          Region: this.region,
          Key: inputs.object!,
          // default request method is GET
          Method: inputs.method ?? 'GET',
          // default expire time is 15min
          Expires: inputs.expires ?? 900,
          // default is sign url
          Sign: inputs.sign === false ? false : true,
        },
        (err, data) => {
          if (err) {
            reject(constructCosError(`API_COS_getObjectUrl`, err));
            return;
          }
          resolve(data.Url);
        },
      );
    });
  }

  async getBucketObjects(bucket: string) {
    try {
      const detail = await this.getBucket({
        bucket,
      });
      const contents = detail.Contents && detail.Contents.length > 0 ? detail.Contents : [];
      const objectKeyList = contents.map((item) => {
        return {
          Key: item.Key,
        };
      });
      return objectKeyList;
    } catch (err) {
      const e = convertCosError(err);
      if (e.code === 'NoSuchBucket') {
        console.log(`Bucket ${bucket} not exist`);
        return [];
      }
      throw err;
    }
  }

  async flushBucketFiles(bucket: string) {
    try {
      console.log(`Start to clear all files in bucket ${bucket}`);
      let objects = await this.getBucketObjects(bucket);
      // 由于 cos 服务一次只能获取 1000 个 object，所以需要循环每次删除 1000 个 object
      while (objects.length > 0) {
        await this.cosClient.deleteMultipleObject({
          Region: this.region,
          Bucket: bucket,
          Objects: objects,
        });

        objects = await this.getBucketObjects(bucket);
      }
      console.log(`Clear all files in bucket ${bucket} success`);
    } catch (e) {
      console.log(`Flush bucket files error: ${e.message}`);
    }
  }

  async upload(inputs: CosUploadInputs = {}) {
    const { bucket, replace } = inputs;
    const { region } = this;

    if (!bucket) {
      throw new ApiTypeError(`PARAMETER_COS`, 'Bucket name is required');
    }

    if (replace) {
      await this.flushBucketFiles(bucket);
    }

    console.log(`Uploading files to bucket ${bucket}`);

    /** 上传文件夹 */
    if (inputs.dir && fs.existsSync(inputs.dir)) {
      const options = { keyPrefix: inputs.keyPrefix };

      const items = traverseDirSync(inputs.dir);

      let key;
      let promises: Promise<PutObjectResult>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // 如果是文件夹跳过
        if (item.stats.isDirectory()) {
          return;
        }

        key = path.relative(inputs.dir!, item.path);
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
        promises.push(this.cosClient.putObject(itemParams));
        // fs.createReadStream(item.path) 会一直打开文件，当文件超过1024会报错
        // 解决方案是分段请求，超过100请求一次，请求后会自动关闭文件
        if (promises.length >= 100) {
          try {
            await Promise.all(promises);
            promises = [];
          } catch (err) {
            throw constructCosError(`API_COS_putObject`, err);
          }
        }
      }
      // 循环结束后可能还有不足100的文件，此时需要单独再上传
      if (promises.length >= 1) {
        try {
          await Promise.all(promises);
          promises = [];
        } catch (err) {
          throw constructCosError(`API_COS_putObject`, err);
        }
      }
    } else if (inputs.file && (await fs.existsSync(inputs.file))) {
      /** 上传文件 */
      const itemParams = {
        Bucket: bucket,
        Region: region,
        Key: inputs.key || path.basename(inputs.file),
        Body: fs.createReadStream(inputs.file),
      };

      try {
        await this.cosClient.putObject(itemParams);
      } catch (err) {
        throw constructCosError('API_COS_putObject', err);
      }
    }
  }

  async website(inputs: CosWebsiteInputs = {}) {
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

    if (inputs.cors) {
      await this.setCors(inputs);
    }

    if (inputs.tags) {
      await this.setTags(inputs);
    }

    await this.setWebsite(inputs);

    // Build environment variables
    const envPath = inputs.code?.envPath || inputs.code?.root;
    if (inputs.env && Object.keys(inputs.env).length && envPath) {
      let script = 'window.env = {};\n';
      inputs.env = inputs.env || {};
      Object.keys(inputs.env).forEach((e) => {
        script += `window.env.${e} = ${JSON.stringify(inputs.env![e])};\n`;
      });

      const envFilePath = path.join(envPath, 'env.js');
      try {
        fs.writeFileSync(envFilePath, script);
      } catch (e) {
        throw new ApiTypeError(`DEPLOY_COS_CREATE_ENV_FILE`, e.message, e.stack);
      }
    }

    // upload
    const dirToUploadPath: string | undefined = inputs.code?.src ?? inputs.code?.root;
    const uploadDict: CosUploadInputs = {
      bucket: inputs.bucket,
      keyPrefix: inputs.keyPrefix || '/',
      replace: inputs.replace!,
    };
    if (fs.lstatSync(dirToUploadPath!).isDirectory()) {
      uploadDict.dir = dirToUploadPath;
    } else {
      uploadDict.file = dirToUploadPath;
    }
    await this.upload(uploadDict);

    return `${inputs.bucket}.cos-website.${this.region}.myqcloud.com`;
  }

  async deploy(inputs: CosDeployInputs = {}): Promise<CosDeployInputs | undefined> {
    if (inputs.ignoreUpdate) {
      console.log('COS update ignored');
      return;
    }
    await this.createBucket(inputs);
    if (inputs.acl) {
      await this.setAcl(inputs);
    }
    if (inputs.policy) {
      await this.setPolicy(inputs);
    }
    if (inputs.cors) {
      await this.setCors(inputs);
    }
    if (inputs.tags) {
      await this.setTags(inputs);
    }
    if (inputs.lifecycle) {
      await this.setLifecycle(inputs);
    }
    if (inputs.versioning) {
      await this.setVersioning(inputs);
    }
    if (inputs.src) {
      // upload
      const dirToUploadPath = inputs.src;
      const uploadDict: CosUploadInputs = {
        bucket: inputs.bucket!,
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

  async remove(inputs: CosRemoveBucketInputs = {}) {
    console.log(`Removing bucket ${inputs.bucket}`);

    let detail;
    try {
      detail = await this.getBucket(inputs);
    } catch (err) {
      const e = convertCosError(err);
      if (e.code === 'NoSuchBucket') {
        console.log(`Bucket ${inputs.bucket} not exist`);
        return;
      }
    }

    // if bucket exist, begain to delate
    if (detail) {
      try {
        // 1. flush all files
        await this.flushBucketFiles(inputs.bucket!);

        // 2. delete bucket
        await this.cosClient.deleteBucket({
          Region: this.region,
          Bucket: inputs.bucket!,
        });
        console.log(`Remove bucket ${inputs.bucket} success`);
      } catch (err) {
        const e = convertCosError(err);
        // why do this judgement again
        // because when requesting to delete, bucket may be deleted even though it exist before.
        if (e.code === 'NoSuchBucket') {
          console.log(`Bucket ${inputs.bucket} not exist`);
        } else {
          // FIXME: APIGW ???
          throw constructCosError(`API_APIGW_deleteBucket`, err);
        }
      }
    }
  }
}
