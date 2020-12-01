const ClsClient = require('@tencent-sdk/cls').Cls;
const { ApiError } = require('../../utils/error');
const { createLogset, createTopic, updateIndex } = require('./utils');

class Cls {
  constructor(credentials = {}, region, expire) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.cls = new ClsClient({
      region: this.region,
      secretId: credentials.SecretId,
      secretKey: credentials.SecretKey,
      token: credentials.Token,
      debug: false,
      expire: expire || 300000,
    });
  }

  async deployLogset(inputs) {
    const outputs = {
      region: this.region,
      name: inputs.name,
      logsetId: '',
    };
    let exist = false;
    const { logsetId } = inputs;
    if (logsetId) {
      const detail = await this.cls.getLogset({
        logset_id: logsetId,
      });
      if (detail.error) {
        throw new ApiError({
          type: 'API_getLogset',
          message: detail.error.message,
        });
      }

      // update it
      if (detail.logset_id) {
        exist = true;
        console.log(`Updating cls ${logsetId}`);
        const res = await this.cls.updateLogset({
          logset_id: logsetId,
          logset_name: inputs.name,
        });
        if (res.error) {
          throw new ApiError({
            type: 'API_updateLogset',
            message: detail.error.message,
          });
        }

        console.log(`Update cls ${logsetId} success`);

        outputs.logsetId = logsetId;
      }
    }

    // if not exist, create cls
    if (!exist) {
      const res = await createLogset(this.cls, {
        name: inputs.name,
        period: inputs.period,
      });
      outputs.logsetId = res.logset_id;
    }

    return outputs;
  }

  async deployTopic(inputs) {
    const outputs = {
      region: this.region,
      name: inputs.topic,
      topicId: '',
    };
    let exist = false;
    const { topicId } = inputs;
    if (topicId) {
      const detail = await this.cls.getTopic({
        topic_id: topicId,
      });
      if (detail.error) {
        throw new ApiError({
          type: 'API_getTopic',
          message: detail.error.message,
        });
      }

      // update it
      if (detail.topic_id) {
        exist = true;
        console.log(`Updating cls topic ${topicId}`);
        const res = await this.cls.updateTopic({
          topic_id: topicId,
          topic_name: inputs.topic,
        });
        if (res.error) {
          throw new ApiError({
            type: 'API_updateTopic',
            message: detail.error.message,
          });
        }

        console.log(`Update cls topic ${topicId} success`);

        outputs.topicId = topicId;
      }
    }

    // if not exist, create cls
    if (!exist) {
      const res = await createTopic(this.cls, {
        logsetId: inputs.logsetId,
        name: inputs.topic,
      });
      outputs.topicId = res.topic_id;
    }

    return outputs;
  }

  async deployIndex(inputs) {
    await updateIndex(this.cls, {
      topicId: inputs.topicId,
      effective: inputs.effective !== false ? true : false,
      rule: inputs.rule,
    });
  }

  async deploy(inputs = {}) {
    const outputs = {
      region: this.region,
      name: inputs.name,
      topic: inputs.topic,
    };

    const logsetOutput = await this.deployLogset(inputs);
    outputs.logsetId = inputs.logsetId = logsetOutput.logsetId;
    const topicOutput = await this.deployTopic(inputs);
    outputs.topicId = inputs.topicId = topicOutput.topicId;
    await this.deployIndex(inputs);

    return outputs;
  }

  async remove(inputs = {}) {
    try {
      console.log(`Start removing cls`);
      console.log(`Removing cls topic id ${inputs.topicId}`);
      const res1 = await this.cls.deleteTopic({
        topic_id: inputs.topicId,
      });
      if (res1.error) {
        throw new ApiError({
          type: 'API_deleteTopic',
          message: res1.error.message,
        });
      }
      console.log(`Removed cls topic id ${inputs.logsetId} success`);
      console.log(`Removing cls id ${inputs.logsetId}`);
      const res2 = await this.cls.deleteLogset({
        logset_id: inputs.logsetId,
      });
      if (res2.error) {
        throw new ApiError({
          type: 'API_deleteLogset',
          message: res2.error.message,
        });
      }
      console.log(`Removed cls id ${inputs.logsetId} success`);
    } catch (e) {
      console.log(e);
    }

    return {};
  }
}

module.exports = Cls;
