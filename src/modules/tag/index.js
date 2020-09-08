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

  async getScfResourceTags(inputs) {
    const data = {
      Action: 'DescribeResourceTags',
      ResourcePrefix: 'namespace',
      ResourceId: `${inputs.namespace || 'default'}/function/${inputs.functionName}`,
    };

    const { Rows } = await this.request(data);
    return Rows;
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
      tagsInputs.DeleteTags = Object.keys(deleteTags).map((key) => ({
        TagKey: key,
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
