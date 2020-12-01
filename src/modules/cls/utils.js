const { ApiError } = require('../../utils/error');

async function getLogsetByName(cls, data) {
  const { logsets = [] } = await cls.getLogsetList();
  const [exist] = logsets.filter((item) => item.logset_name === data.name);
  return exist;
}

async function createLogset(cls, data) {
  console.log(`Creating cls ${data.name}`);
  const res = await cls.createLogset({
    logset_name: data.name,
    period: data.period,
  });
  if (res.error) {
    if (res.error.message.indexOf('409') !== -1) {
      console.log(`Cls name ${data.name} already exist`);
      return getLogsetByName(cls, {
        name: data.name,
      });
    }
    throw new ApiError({
      type: 'API_createLogset',
      message: res.error.message,
    });
  }
  console.log(`Created cls ${data.name}, id ${res.logset_id} success`);

  return res;
}

async function getTopicByName(cls, data) {
  const { topics = [] } = await cls.getTopicList({
    logset_id: data.logsetId,
  });
  const [exist] = topics.filter((item) => item.topic_name === data.name);
  return exist;
}

async function createTopic(cls, data) {
  console.log(`Creating cls topic ${data.name}`);
  const res = await cls.createTopic({
    logset_id: data.logsetId,
    topic_name: data.name,
  });
  if (res.error) {
    if (res.error.message.indexOf('409') !== -1) {
      console.log(`Cls topic name ${data.name} already exist`);
      return getTopicByName(cls, {
        logsetId: data.logsetId,
        name: data.name,
      });
    }
    throw new ApiError({
      type: 'API_createTopic',
      message: res.error.message,
    });
  }
  console.log(`Created cls topic ${data.name}, id ${res.topic_id} success`);
  return res;
}

async function updateIndex(cls, data) {
  const res = await cls.updateIndex({
    topic_id: data.topicId,
    effective: true,
    rule: data.rule,
  });
  if (res.error) {
    throw new ApiError({
      type: 'API_updateIndex',
      message: res.error.message,
    });
  }
  return res;
}

module.exports = { createLogset, createTopic, updateIndex };
