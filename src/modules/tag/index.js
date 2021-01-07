const { Capi } = require('@tencent-sdk/capi');
const Apis = require('./apis');

class Tag {
  constructor(credentials = {}, region = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      AppId: this.credentials.AppId,
      SecretId: this.credentials.SecretId,
      SecretKey: this.credentials.SecretKey,
      Token: this.credentials.Token,
    });
  }

  async request({ Action, ...data }) {
    const result = await Apis[Action](this.capi, data);
    return result;
  }

  async getResourceTags({ resourceId, serviceType, resourcePrefix, offset = 0, limit = 100 }) {
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

  async getTagList(offset = 0, limit = 100) {
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

  async isTagExist(tag) {
    const tagList = await this.getTagList();
    const [exist] = tagList.filter(
      (item) => item.TagKey === tag.TagKey && item.TagValue === tag.TagValue,
    );
    return !!exist;
  }

  async getScfResourceTags(inputs) {
    const tags = await this.getResourceTags({
      resourceId: `${inputs.namespace || 'default'}/function/${inputs.functionName}`,
      serviceType: 'scf',
      resourcePrefix: 'namespace',
    });

    return tags;
  }

  async attachTags({ serviceType, resourcePrefix, resourceIds, tags }) {
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

  async detachTags({ serviceType, resourcePrefix, resourceIds, tags }) {
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
      delete tagInputs.TagValue;
      await this.request(tagInputs);
    }
  }

  async createTag(tag) {
    console.log(`Creating tag key: ${tag.TagKey}, value: ${tag.TagValue}`);
    await this.request({
      Action: 'CreateTag',
      ...tag,
    });

    return tag;
  }

  async deleteTag(tag) {
    console.log(`Deleting tag key: ${tag.TagKey}, value: ${tag.TagValue}`);
    await this.request({
      Action: 'DeleteTag',
      ...tag,
    });

    return true;
  }

  async deleteTags(tags) {
    for (let i = 0; i < tags.length; i++) {
      await this.deleteTag(tags[i]);
    }

    return true;
  }

  async deploy(inputs = {}) {
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

  async deployResourceTags({ tags, resourceId, serviceType, resourcePrefix }) {
    console.log(`Adding tags for ${resourceId} in ${this.region}`);
    const inputKeys = [];
    tags.forEach(({ TagKey }) => {
      inputKeys.push(TagKey);
    });

    const oldTags = await this.getResourceTags({
      resourceId: resourceId,
      serviceType: serviceType,
      resourcePrefix: resourcePrefix,
    });

    const oldTagKeys = [];
    oldTags.forEach(({ TagKey }) => {
      oldTagKeys.push(TagKey);
    });

    const detachTags = [];
    const attachTags = [];
    const leftTags = [];

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

module.exports = Tag;
