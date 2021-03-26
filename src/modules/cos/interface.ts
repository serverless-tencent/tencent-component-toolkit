export interface CosCreateBucketInputs {
  bucket?: string;
  force?: boolean;
}

export interface CosSetAclInputs {
  bucket?: string;
  acl?: {
    accessControlPolicy?: {
      owner?: {
        id?: string;
        displayName?: string;
      };
      grants?: {
        permission?: 'READ' | 'WRITE';
        grantee?: {
          id?: string;
          displayName?: string;
          uri?: string;
        };
      };
    };
    grantRead?: string;
    grantWrite?: string;
    grantReadAcp?: string;
    grantWriteAcp?: string;
    grantFullControl?: string;
    permissions?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read';
  };
}

export interface CosSetPolicyInputs {
  bucket?: string;
  policy?: object;
}

export interface CosSetTagInputs {
  bucket?: string;
  tags?: { key: string; value: string }[];
}

export interface CosDeleteTagsInputs {
  bucket?: string;
  tags?: { key: string; value: string }[];
}

export interface CosSetCorsInputs {
  bucket?: string;
  cors?: {
    allowedMethods: string[];
    allowedOrigins: string[];

    maxAgeSeconds?: number;
    id?: string;
    allowedHeaders?: string[];
    exposeHeaders?: string[];
  }[];
}

export interface CosDeleteCorsInputs {
  bucket?: string;
  cors?: {
    allowedMethods: string[];
    allowedOrigins: string[];

    maxAgeSeconds?: number;
    id?: string;
    allowedHeaders?: string[];
    exposeHeaders?: string[];
  }[];
}

export interface CosSetLifecycleInputs {
  bucket?: string;
  lifecycle?: {
    id: string;
    status: 'Enabled' | 'Disabled';
    filter?: {
      prefix?: string;
    };
    transition?: {
      days?: number | string;
      storageClass?: string;
    };
    // FIXME: 此处应为小写？
    NoncurrentVersionTransition?: {
      noncurrentDays?: number | string;
      storageClass?: number | string;
    };
    expiration?: {
      days?: number | string;
      expiredObjectDeleteMarker?: string;
    };
    abortIncompleteMultipartUpload?: {
      daysAfterInitiation?: number | string;
    };
  }[];
}

export interface CosDeleteLifecycleInputs {
  bucket?: string;
}

export interface CosSetVersioningInputs {
  bucket?: string;
  versioning?: string;
}

export interface WebsiteRedirectRule {
  /** 重定向规则的条件配置 */
  Condition: {
    /** 指定重定向规则的错误码匹配条件，只支持配置4XX返回码，例如403或404，HttpErrorCodeReturnedEquals 与 KeyPrefixEquals 必选其一 */
    HttpErrorCodeReturnedEquals?: string | number;
    /** 指定重定向规则的对象键前缀匹配条件，HttpErrorCodeReturnedEquals 与 KeyPrefixEquals 必选其一 */
    KeyPrefixEquals?: 'Enabled' | 'Disabled';
  };
  /** 重定向规则的具体重定向目标配置 */
  Redirect: {
    /** 指定重定向规则的目标协议，只能设置为 https */
    Protocol?: 'https' | string;
    /** 指定重定向规则的具体重定向目标的对象键，替换方式为替换整个原始请求的对象键，ReplaceKeyWith 与 ReplaceKeyPrefixWith 必选其一 */
    ReplaceKeyWith?: string;
    /** 指定重定向规则的具体重定向目标的对象键，替换方式为替换原始请求中所匹配到的前缀部分，仅可在 Condition 为 KeyPrefixEquals 时设置，ReplaceKeyWith 与 ReplaceKeyPrefixWith 必选其一 */
    ReplaceKeyPrefixWith?: string;
  };
}

export interface CosSetWebsiteInputs extends CosSetAclInputs, CosSetPolicyInputs, CosSetCorsInputs {
  bucket?: string;
  code?: {
    src: string;
    root?: string;
    index?: string;
    envPath?: string;
    error?: string;
  };
  src?: string;
  replace?: boolean;
  env?: Record<string, any>;
  protocol?: string;
  disableErrorStatus?: string | boolean;
  ignoreHtmlExt?: boolean;
  redirectRules?: WebsiteRedirectRule[];
}

export interface CosGetObjectUrlInputs {
  bucket?: string;
  object?: string;
  method?:
    | 'GET'
    | 'DELETE'
    | 'POST'
    | 'PUT'
    | 'OPTIONS'
    | 'get'
    | 'delete'
    | 'post'
    | 'put'
    | 'options';
  expires?: number;
  sign?: boolean;
}

export interface CosGetBucketInputs {
  bucket?: string;
}

export interface CosUploadInputs {
  bucket?: string;
  replace?: boolean;
  dir?: string;
  keyPrefix?: string;
  file?: string;
  key?: string;
}

export interface CosWebsiteInputs extends CosSetWebsiteInputs {
  bucket?: string;
  force?: boolean;
}

export interface CosDeployInputs
  extends CosSetAclInputs,
    CosSetPolicyInputs,
    CosSetCorsInputs,
    CosSetTagInputs,
    CosSetLifecycleInputs,
    CosSetVersioningInputs,
    CosWebsiteInputs {
  keyPrefix?: string;
  rules?: {
    status?: string;
    id?: string;
    filter?: string;
    expiration?: { days?: string };
    abortIncompleteMultipartUpload?: { daysAfterInitiation?: string };
  }[];
}

export interface CosRemoveBucketInputs {
  bucket?: string;
}
