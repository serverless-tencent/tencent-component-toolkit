import { Cls } from '@tencent-sdk/cls';
import { IndexRule } from '@tencent-sdk/cls/dist/typings';
import { ApiError } from '../../utils/error';
import {
  StatusSqlMapEnum,
  GetSearchSqlOptions,
  CreateAlarmOptions,
  CreateNoticeOptions,
} from './interface';

export async function getLogsetByName(cls: Cls, data: { name: string }) {
  const { logsets = [] } = await cls.getLogsetList();
  const [exist] = logsets.filter((item: { logset_name: string }) => item.logset_name === data.name);
  return exist;
}

/**
 * 创建 cls 日志集
 * @param cls
 * @param data
 */
export async function createLogset(cls: Cls, data: { name: string; period: number }) {
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

export async function getTopicByName(cls: Cls, data: { name: string; logsetId: string }) {
  const { topics = [] } = await cls.getTopicList({
    logset_id: data.logsetId,
  });
  const [exist] = topics.filter((item: { topic_name: string }) => item.topic_name === data.name);
  return exist;
}

/**
 * 创建 cls 主题
 * @param cls
 * @param data
 */
export async function createTopic(cls: Cls, data: { name: string; logsetId: string }) {
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

export async function updateIndex(
  cls: Cls,
  data: {
    topicId: string;
    rule?: IndexRule;
    effective: boolean;
  },
) {
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
 * 获取 cls trigger
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
export async function getClsTrigger(
  cls: Cls,
  data: {
    topic_id?: string;
    namespace?: string;
    function_name?: string;
    qualifier?: string;
    max_wait?: number;
    max_size?: number;
  },
) {
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
 * 创建 cls trigger
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
export async function createClsTrigger(
  cls: Cls,
  data: {
    topic_id?: string;
    namespace?: string;
    function_name?: string;
    qualifier?: string;
    max_wait?: number;
    max_size?: number;
  },
) {
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
 * 更新 cls trigger
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
export async function updateClsTrigger(
  cls: Cls,
  data: {
    topic_id?: string;
    namespace?: string;
    function_name?: string;
    qualifier: string;
    max_wait?: number;
    max_size?: number;
    effective?: boolean;
  },
) {
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
export async function deleteClsTrigger(cls: Cls, data: { topic_id: string }) {
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

const StatusSqlMap: StatusSqlMapEnum = {
  success: 'SCF_StatusCode=200',
  fail: 'SCF_StatusCode != 200 AND SCF_StatusCode != 202 AND SCF_StatusCode != 499',
  retry: 'SCF_RetryNum > 0',
  interrupt: 'SCF_StatusCode = 499',
  timeout: 'SCF_StatusCode = 433',
  exceed: 'SCF_StatusCode = 434',
  codeError: 'SCF_StatusCode = 500',
};

export function formatWhere({
  functionName,
  namespace = 'default',
  qualifier = '$LATEST',
  status,
  startTime,
  endTime,
}: Partial<GetSearchSqlOptions>) {
  let where = `SCF_Namespace='${namespace}' AND SCF_Qualifier='${qualifier}'`;
  if (startTime && endTime) {
    where += ` AND (SCF_StartTime between ${startTime} AND ${endTime})`;
  }
  if (functionName) {
    where += ` AND SCF_FunctionName='${functionName}'`;
  }
  if (status) {
    where += ` AND ${StatusSqlMap[status]}'`;
  }

  return where;
}

export function getSearchSql(options: GetSearchSqlOptions) {
  const where = formatWhere(options);
  const sql = `* | SELECT SCF_RequestId as requestId, SCF_RetryNum as retryNum, MAX(SCF_StartTime) as startTime WHERE ${where} GROUP BY SCF_RequestId, SCF_RetryNum ORDER BY startTime desc`;

  return sql;
}

// 格式化告警配置参数
export function formatAlarmOptions(options: CreateAlarmOptions) {
  const { targets = [], monitor = { type: 'Period', time: 15 }, trigger, noticeId = '' } = options;
  const AlarmTargets = targets.map((item, index) => {
    return {
      LogsetId: options.logsetId,
      TopicId: options.topicId,
      Query: item.query,
      Number: index + 1,
      StartTimeOffset: -(item.period ?? 15),
      EndTimeOffset: 0,
    };
  });
  return {
    Name: options.name,
    AlarmTargets,
    MonitorTime: {
      Type: monitor.type ?? 'Period',
      Time: monitor.type === 'Fixed' ? monitor.time + 1 : monitor.time,
    },
    Condition: trigger.condition,
    TriggerCount: trigger.count ?? 1,
    AlarmPeriod: trigger.period ?? 15,
    AlarmNoticeIds: [noticeId],
    Status: options.status ?? true,
  };
}

// 格式化通知配置参数
export function formatNoticeOptions(options: CreateNoticeOptions) {
  const { name, type, receivers, webCallbacks } = options;
  const NoticeReceivers = receivers.map((item) => {
    return {
      EndTime: item.end,
      ReceiverChannels: item.channels,
      ReceiverIds: item.ids,
      ReceiverType: item.type,
      StartTime: item.start,
    };
  });
  const WebCallbacks = webCallbacks.map((item) => {
    return item.type === 'WeCom'
      ? {
          Body: item.body,
          CallbackType: item.type,
          Url: item.url,
        }
      : {
          Body: item.body,
          CallbackType: item.type,
          Url: item.url,
          Headers: item.headers,
          Method: item.method,
        };
  });
  return {
    Name: name,
    NoticeReceivers,
    Type: type,
    WebCallbacks: WebCallbacks,
  };
}
