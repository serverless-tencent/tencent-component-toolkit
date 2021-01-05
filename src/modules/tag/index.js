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
    const data = {
      Action: 'DescribeResourceTags',
      ResourcePrefix: 'namespace',
      ResourceId: `${inputs.namespace || 'default'}/function/${inputs.functionName}`,
    };

    const { Rows } = await this.request(data);
    return Rows;
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
}

module.exports = Tag;
