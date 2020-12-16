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

/**
 * get cls trigger
 * @param {ClsInstance} cls
 * @param {Data} data
 *  Data:
 *  {
 *    "topic_id": string,       日志主题 ID
 *    "namespace": string,      函数命名空间
 *    "function_name": string,  函数名称
 *    "qualifier": string,      函数版本
 *    "max_wait": number,       投递最长等待时间，单位 秒
 *    "max_size": number        投递最大消息数
 *  }
 */
async function getClsTrigger(cls, data) {
  const res = await cls.request({
    path: '/deliverfunction',
    method: 'GET',
    query: data,
  });

  if (res.error) {
    if (res.error.message.indexOf('404') !== -1) {
      return undefined;
    }
    throw new ApiError({
      type: 'API_getClsTrigger',
      message: res.error.message,
    });
  }
  return res;
}

/**
 * create cls trigger
 * @param {ClsInstance} cls
 * @param {Data} data
 *  Data:
 *  {
 *    "topic_id": string,       日志主题 ID
 *    "namespace": string,      函数命名空间
 *    "function_name": string,  函数名称
 *    "qualifier": string,      函数版本
 *    "max_wait": number,       投递最长等待时间，单位 秒
 *    "max_size": number        投递最大消息数
 *  }
 */
async function createClsTrigger(cls, data) {
  const res = await cls.request({
    path: '/deliverfunction',
    method: 'POST',
    data,
  });
  if (res.error) {
    throw new ApiError({
      type: 'API_createClsTrigger',
      message: res.error.message,
    });
  }
  return res;
}

/**
 * update cls trigger
 * @param {ClsInstance} cls
 * @param {Data} data
 *  Data:
 *  {
 *    "topic_id": string,       日志主题 ID
 *    "namespace": string,      函数命名空间
 *    "function_name": string,  函数名称
 *    "qualifier": string,      函数版本
 *    "max_wait": number,       投递最长等待时间，单位 秒
 *    "max_size": number        投递最大消息数
 *    "effective": boolean      投递开关
 *  }
 */
async function updateClsTrigger(cls, data) {
  const res = await cls.request({
    path: '/deliverfunction',
    method: 'PUT',
    data,
  });
  if (res.error) {
    throw new ApiError({
      type: 'API_updateClsTrigger',
      message: res.error.message,
    });
  }
  return res;
}

/**
 * 删除 cls trigger
 * @param {ClsInstance} cls
 * @param {Data} data
 *  Data:
 *  {
 *    "topic_id": string,       日志主题 ID
 *  }
 */
async function deleteClsTrigger(cls, data) {
  const res = await cls.request({
    path: '/deliverfunction',
    method: 'DELETE',
    query: data,
  });
  if (res.error) {
    throw new ApiError({
      type: 'API_deleteClsTrigger',
      message: res.error.message,
    });
  }
  return res;
}

module.exports = {
  createLogset,
  createTopic,
  updateIndex,
  getClsTrigger,
  createClsTrigger,
  updateClsTrigger,
  deleteClsTrigger,
};
