
import { ServiceType } from "../interface";

export interface TagData {
    TagKey: string;
    TagValue?: string;
}

export interface TagGetResourceTagsInputs {
    resourceId: string;
    serviceType: ServiceType;
    resourcePrefix: string;
    offset?: number;
    limit?: number;
}

export interface TagGetScfResourceTags {
 namespace: string,
 functionName: string,
}

export interface TagAttachTagsInputs {
    serviceType: ServiceType;
    resourcePrefix: string;
    resourceIds: string[];
    tags: TagData[]
}

export interface TagDetachTagsInputs {
    serviceType: ServiceType;
    resourcePrefix: string;
    resourceIds: string[];
    tags: TagData[];
}

export interface TagDeployInputs {
    detachTags: TagData[],
    attachTags: TagData[],
    serviceType: ServiceType,
    resourceIds: string[],
    resourcePrefix: string
}


export interface TagDeployResourceTagsInputs {
    tags: TagData[],
    resourceId: string,
    serviceType: ServiceType,
    resourcePrefix: string;
}