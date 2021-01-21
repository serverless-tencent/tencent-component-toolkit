
import { ApiServiceType } from "../interface";

export interface TagData {
    TagKey: string;
    TagValue?: string;
}

export interface TagGetResourceTagsInputs {
    resourceId: string;
    serviceType: ApiServiceType;
    resourcePrefix: string;
    offset?: number;
    limit?: number;
}

export interface TagGetScfResourceTags {
 namespace: string,
 functionName: string,
}

export interface TagAttachTagsInputs {
    serviceType: ApiServiceType;
    resourcePrefix: string;
    resourceIds: string[];
    tags: TagData[]
}

export interface TagDetachTagsInputs {
    serviceType: ApiServiceType;
    resourcePrefix: string;
    resourceIds: string[];
    tags: TagData[];
}

export interface TagDeployInputs {
    detachTags: TagData[],
    attachTags: TagData[],
    serviceType: ApiServiceType,
    resourceIds: string[],
    resourcePrefix: string
}


export interface TagDeployResourceTagsInputs {
    tags: TagData[],
    resourceId: string,
    serviceType: ApiServiceType,
    resourcePrefix: string;
}