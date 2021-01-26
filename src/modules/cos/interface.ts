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

export interface CosSetWebsiteInputs extends CosSetAclInputs, CosSetPolicyInputs, CosSetCorsInputs {
  bucket?: string;
  code?: {
    src: string;
    root?: string;
    index?: string;
    envPath: string;
    error?: string;
  };
  replace?: string;
  env?: Record<string, any>;
  protocol?: string;
  disableErrorStatus?: string | boolean;
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
  replace?: string;
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
    CosSetVersioningInputs {
  src?: string;
  keyPrefix?: string;
  replace?: string;
}

export interface CosRemoveBucketInputs {
  bucket?: string;
}
