const { Capi } = require('@tencent-sdk/capi');
const Apis = require('./apis');
const { camelCaseProperty } = require('../../utils/index');

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
    const result = await Apis[Action](this.capi, camelCaseProperty(data));
    return result;
  }

  async addArray(body, tags, key) {
    let index = 0;
    for (const item in tags) {
      body[`${key}.${index}.TagKey`] = item;
      body[`${key}.${index}.TagValue`] = tags[item];
      index++;
    }
    return body;
  }

  async deploy(inputs = {}) {
    const tagsInputs = {
      Action: 'ModifyResourceTags',
      Resource: inputs.resource,
    };

    const { replaceTags = {}, deleteTags = {} } = inputs;

    if (Object.keys(replaceTags).length > 0) {
      tagsInputs.ReplaceTags = Object.entries(replaceTags).map(([key, val]) => ({
        TagKey: key,
        TagValue: val,
      }));
    }
    if (Object.keys(deleteTags).length > 0) {
      tagsInputs.DeleteTags = Object.entries(deleteTags).map(([key, val]) => ({
        TagKey: key,
        TagValue: val,
      }));
    }

    console.log(`Updating tags`);
    try {
      await this.request(tagsInputs);
    } catch (e) {
      console.log(e);
    }
    console.log(`Update tags success.`);

    return true;
  }
}

module.exports = Tag;
