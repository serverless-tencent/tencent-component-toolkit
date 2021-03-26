import { RegionType, CapiCredentials } from './../interface';
import COS, {
  CORSRule,
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

export interface CosError {
  error?:
    | {
        Code?: string;
        Message?: string;
        Stack?: string;
        RequestId?: string;
      }
    | string;
  code?: string;
  message?: string;
  stack?: string;
  requestId?: string;
}

/** 将 Cos error 转为统一的形式 */
export function convertCosError(err: CosError) {
  if (typeof err.error === 'string') {
    return {
      code: err.code!,
      message: err.message! ?? err.error,
      stack: err?.stack,
      reqId: err?.requestId,
    };
  }
  return {
    code: err?.error?.Code ?? err.code!,
    message: err?.error?.Message ?? err.message!,
    stack: err?.stack ?? err?.error?.Stack!,
    reqId: err?.error?.RequestId ?? err.requestId!,
  };
}

function constructCosError(
  type: string,
  err: {
    error: {
      Code: string;
      Message: string;
      Stack: string;
      RequestId: string;
    };
    stack: string;
  },
) {
  const e = convertCosError(err);
  return new ApiError({ type, ...e });
}

export default class Cos {
  credentials: CapiCredentials;
  region: RegionType;
  cosClient: COS;

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
    // 在创建之前，检查是否存在
    const exist = await this.isBucketExist(inputs.bucket!);
    if (exist) {
      return true;
    }
    // 不存在就尝试创建
    console.log(`Creating bucket ${inputs.bucket}`);
    const createParams = {
      Bucket: inputs.bucket!,
      Region: this.region,
    };

    try {
      await this.cosClient.putBucket(createParams);
    } catch (err) {
      const e = convertCosError(err);
      if (e.code === 'BucketAlreadyExists' || e.code === 'BucketAlreadyOwnedByYou') {
        if (!inputs.force) {
          throw constructCosError(`API_COS_putBucket`, err);
        } else {
          console.log(`Bucket ${inputs.bucket} already exist.`);
        }
      } else {
        // TODO: cos在云函数中可能出现ECONNRESET错误，没办法具体定位，初步猜测是客户端问题，是函数启动网络还没准备好，这个还不确定，所以在这里做兼容
        if (e?.message?.includes('ECONNRESET')) {
          // 检查bucket是否存在
          try {
            const isHave = await this.cosClient.headBucket(createParams);
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
          } catch (errAgain) {
            throw constructCosError(`API_COS_headBucket`, errAgain);
          }
        } else {
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
          DisplayName: acp?.owner?.displayName!,
        },
        Grants: {
          Permission: acp?.grants?.permission!,
          // FIXME: dont have URI
          Grantee: {
            ID: acp?.grants?.grantee?.id!,
            DisplayName: acp.grants?.grantee?.displayName!,
            // URI: acp?.grants?.grantee?.uri!,
          },
        },
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
    try {
      const res = await this.cosClient.getObjectUrl({
        Bucket: inputs.bucket!,
        Region: this.region,
        Key: inputs.object!,
        // default request method is GET
        Method: inputs.method ?? 'GET',
        // default expire time is 15min
        Expires: inputs.expires ?? 900,
        // default is sign url
        Sign: inputs.sign === false ? false : true,
      });
      // FIXME: Fuck you Cos SDK, res is not an object;
      return (res as unknown) as string;
    } catch (err) {
      throw constructCosError(`API_COS_getObjectUrl`, err);
    }
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

    console.log(`Uploding files to bucket ${bucket}`);

    /** 上传文件夹 */
    if (inputs.dir && fs.existsSync(inputs.dir)) {
      const options = { keyPrefix: inputs.keyPrefix };

      const items = traverseDirSync(inputs.dir);

      let key;
      const promises: Promise<PutObjectResult>[] = [];
      items.forEach((item) => {
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
      });
      try {
        await Promise.all(promises);
      } catch (err) {
        throw constructCosError(`API_COS_putObject`, err);
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

  async deploy(inputs: CosDeployInputs = {}) {
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
