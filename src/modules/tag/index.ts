import { RegionType, CapiCredentials, ApiServiceType } from './../interface';
import { Capi } from '@tencent-sdk/capi';
import APIS from './apis';
import { TagData, TagGetResourceTagsInputs, TagGetScfResourceTags, TagAttachTagsInputs, TagDetachTagsInputs, TagDeployInputs, TagDeployResourceTagsInputs } from './interface';

export default class Tag {
  region: RegionType;
  credentials: CapiCredentials;
  capi: Capi;

  constructor(credentials = {}, region: RegionType = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.tag,
      // FIXME: AppId: this.credentials.AppId,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });
  }

  async request({ Action, ...data }: any) {
    const result = await APIS[Action](this.capi, data);
    return result;
  }

  async getResourceTags({
    resourceId,
    serviceType,
    resourcePrefix,
    offset = 0,
    limit = 100,
  }: TagGetResourceTagsInputs): Promise<TagData[]> {
    const { Tags, TotalCount } = await this.request({
      Action: 'DescribeResourceTagsByResourceIds',
      Limit: limit,
      Offset: offset,
      ServiceType: serviceType,
      ResourceRegion: this.region,
      ResourcePrefix: resourcePrefix,
      ResourceIds: [resourceId],
    });
    if (TotalCount > limit) {
      return Tags.concat(
        await this.getResourceTags({
          resourceId,
          serviceType,
          resourcePrefix,
          offset: offset + limit,
          limit,
        }),
      );
    }

    return Tags;
  }

  async getTagList(offset: number = 0, limit: number = 100): Promise<TagData[]> {
    const { Tags, TotalCount } = await this.request({
      Action: 'DescribeTags',
      Limit: limit,
      Offset: offset,
    });
    if (TotalCount > limit) {
      return Tags.concat(await this.getTagList(offset + limit, limit));
    }

    return Tags;
  }

  async isTagExist(tag: TagData) {
    const tagList = await this.getTagList();
    const [exist] = tagList.filter(
      (item) => item.TagKey === tag.TagKey && item.TagValue === tag.TagValue,
    );
    return !!exist;
  }

  async getScfResourceTags(inputs: TagGetScfResourceTags) {
    const tags = await this.getResourceTags({
      resourceId: `${inputs.namespace ?? 'default'}/function/${inputs.functionName}`,
      serviceType: ApiServiceType.scf,
      resourcePrefix: 'namespace',
    });

    return tags;
  }

  async attachTags({ serviceType, resourcePrefix, resourceIds, tags }:TagAttachTagsInputs) {
    const commonInputs = {
      Action: 'AttachResourcesTag',
      ResourceIds: resourceIds,
      ServiceType: serviceType,
      ResourceRegion: this.region,
      ResourcePrefix: resourcePrefix,
    };
    // if tag not exsit, create it

    for (let i = 0; i < tags.length; i++) {
      const currentTag = tags[i];
      const tagExist = await this.isTagExist(currentTag);
      if (!tagExist) {
        await this.createTag(currentTag);
      }
      const tagInputs = {
        ...commonInputs,
        ...currentTag,
      };
      await this.request(tagInputs);
    }
  }

  async detachTags({ serviceType, resourcePrefix, resourceIds, tags }:TagDetachTagsInputs) {
    const commonInputs = {
      Action: 'DetachResourcesTag',
      ResourceIds: resourceIds,
      ServiceType: serviceType,
      ResourceRegion: this.region,
      ResourcePrefix: resourcePrefix,
    };
    for (let i = 0; i < tags.length; i++) {
      const tagInputs = {
        ...commonInputs,
        ...tags[i],
      };
      delete (tagInputs as any).TagValue;
      await this.request(tagInputs);
    }
  }

  async createTag(tag: TagData) {
    console.log(`Creating tag key: ${tag.TagKey}, value: ${tag.TagValue}`);
    await this.request({
      Action: 'CreateTag',
      ...tag,
    });

    return tag;
  }

  async deleteTag(tag: TagData) {
    console.log(`Deleting tag key: ${tag.TagKey}, value: ${tag.TagValue}`);
    await this.request({
      Action: 'DeleteTag',
      ...tag,
    });

    return true;
  }

  async deleteTags(tags: TagData[]) {
    for (let i = 0; i < tags.length; i++) {
      await this.deleteTag(tags[i]);
    }

    return true;
  }

  async deploy(inputs:TagDeployInputs = {} as any) {
    const { detachTags = [], attachTags = [], serviceType, resourceIds, resourcePrefix } = inputs;

    console.log(`Updating tags`);
    try {
      await this.detachTags({
        tags: detachTags,
        serviceType,
        resourceIds,
        resourcePrefix,
      });
      await this.attachTags({
        tags: attachTags,
        serviceType,
        resourceIds,
        resourcePrefix,
      });
    } catch (e) {
      console.log(e);
    }
    console.log(`Update tags success`);

    return true;
  }

  async deployResourceTags({ tags, resourceId, serviceType, resourcePrefix }: TagDeployResourceTagsInputs) {
    console.log(`Adding tags for ${resourceId} in ${this.region}`);
    const inputKeys:string[] = [];
    tags.forEach(({ TagKey }) => {
      inputKeys.push(TagKey);
    });

    const oldTags = await this.getResourceTags({
      resourceId: resourceId,
      serviceType: serviceType,
      resourcePrefix: resourcePrefix,
    });

    const oldTagKeys:string[] = [];
    oldTags.forEach(({ TagKey }) => {
      oldTagKeys.push(TagKey);
    });

    const detachTags:TagData[] = [];
    const attachTags:TagData[] = [];
    const leftTags:TagData[] = [];

    oldTags.forEach((item) => {
      if (inputKeys.indexOf(item.TagKey) === -1) {
        detachTags.push({
          TagKey: item.TagKey,
        });
      } else {
        const [inputTag] = tags.filter((t) => t.TagKey === item.TagKey);
        const oldTagVal = item.TagValue;

        if (inputTag.TagValue !== oldTagVal) {
          attachTags.push(inputTag);
        } else {
          leftTags.push(item);
        }
      }
    });

    tags.forEach((item) => {
      if (oldTagKeys.indexOf(item.TagKey) === -1) {
        attachTags.push(item);
      }
    });

    await this.deploy({
      resourceIds: [resourceId],
      resourcePrefix: resourcePrefix,
      serviceType: serviceType,
      detachTags,
      attachTags,
    });

    return leftTags.concat(attachTags);
  }
}
