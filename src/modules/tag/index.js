const { tag } = require('tencent-cloud-sdk');
class Tag {
  constructor(credentials = {}, region = 'ap-guangzhou') {
    this.credentials = credentials;
    this.region = region;
    this.tagClient = new tag(this.credentials);
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
    let tagsInputs = {
      Action: 'ModifyResourceTags',
      Version: '2018-08-13',
      Region: this.region,
      Resource: inputs.resource,
    };

    tagsInputs = await this.addArray(tagsInputs, inputs.replaceTags, 'ReplaceTags');
    tagsInputs = await this.addArray(tagsInputs, inputs.deleteTags, 'DeleteTags');

    console.log(`Updating tags`);
    try {
      await this.tagClient.request(tagsInputs);
    } catch (e) {
      console.log(e);
    }
    console.log(`Update tags success.`);

    return true;
  }
}

module.exports = Tag;
