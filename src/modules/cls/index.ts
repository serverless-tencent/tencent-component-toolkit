import { Cls as ClsClient } from '@tencent-sdk/cls';
import dayjs, { Dayjs } from 'dayjs';
import {
  ClsDelopyIndexInputs,
  ClsDeployInputs,
  ClsDeployLogsetInputs,
  ClsDeployOutputs,
  ClsDeployTopicInputs,
  GetLogOptions,
  GetLogDetailOptions,
  LogContent,
} from './interface';
import { CapiCredentials, RegionType } from './../interface';
import { ApiError } from '../../utils/error';
import { createLogset, createTopic, updateIndex, getSearchSql } from './utils';

const TimeFormat = 'YYYY-MM-DD HH:mm:ss';

export default class Cls {
  credentials: CapiCredentials;
  region: RegionType;
  cls: ClsClient;

  constructor(credentials: CapiCredentials, region: RegionType = 'ap-guangzhou', expire?: number) {
    this.region = region;
    this.credentials = credentials;
    this.cls = new ClsClient({
      region: this.region,
      secretId: credentials.SecretId!,
      secretKey: credentials.SecretKey!,
      token: credentials.Token,
      debug: false,
      expire: expire,
    });
  }

  async deployLogset(inputs: ClsDeployLogsetInputs = {} as any) {
    const outputs = {
      region: this.region,
      name: inputs.name,
      period: inputs.period,
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
          period: inputs.period!,
          logset_id: logsetId,
          logset_name: inputs.name!,
        });
        if (res.error) {
          throw new ApiError({
            type: 'API_updateLogset',
            message: detail.error!.message!,
          });
        }

        console.log(`Update cls ${logsetId} success`);

        outputs.logsetId = logsetId;
      }
    }

    // if not exist, create cls
    if (!exist) {
      const res = await createLogset(this.cls, {
        name: inputs.name!,
        period: inputs.period!,
      });
      outputs.logsetId = res?.logset_id;
    }

    return outputs;
  }

  async deployTopic(inputs: ClsDeployTopicInputs) {
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
          // FIXME: SDK 需要 logset_id, 但是没有
          // logset_id: '',
          topic_id: topicId,
          topic_name: inputs.topic,
        } as any);
        if (res.error) {
          throw new ApiError({
            type: 'API_updateTopic',
            message: detail.error!.message,
          });
        }

        console.log(`Update cls topic ${topicId} success`);

        outputs.topicId = topicId;
      }
    }

    // if not exist, create cls
    if (!exist) {
      const res = await createTopic(this.cls, {
        logsetId: inputs.logsetId!,
        name: inputs.topic!,
      });
      outputs.topicId = res.topic_id;
    }

    return outputs;
  }

  async deployIndex(inputs: ClsDelopyIndexInputs) {
    await updateIndex(this.cls, {
      topicId: inputs.topicId!,
      // FIXME: effective is always true in updateIndex
      effective: inputs.effective !== false ? true : false,
      rule: inputs.rule,
    });
  }

  async deploy(inputs: ClsDeployInputs = {}) {
    const outputs: ClsDeployOutputs = {
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

  async remove(inputs: { topicId?: string; logsetId?: string } = {}) {
    try {
      console.log(`Start removing cls`);
      console.log(`Removing cls topic id ${inputs.topicId}`);
      const res1 = await this.cls.deleteTopic({
        topic_id: inputs.topicId!,
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
        logset_id: inputs.logsetId!,
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

  async getLogList(data: GetLogOptions) {
    const clsClient = new ClsClient({
      region: this.region,
      secretId: this.credentials.SecretId!,
      secretKey: this.credentials.SecretKey!,
      token: this.credentials.Token,
      debug: false,
    });

    const { endTime, interval = 3600 } = data;
    let startDate: Dayjs;
    let endDate: Dayjs;

    // 默认获取从当前到一个小时前时间段的日志
    if (!endTime) {
      endDate = dayjs();
      startDate = endDate.add(-1, 'hour');
    } else {
      endDate = dayjs(endTime);
      startDate = dayjs(endDate.valueOf() - Number(interval) * 1000);
    }

    const sql = getSearchSql({
      ...data,
      startTime: startDate.valueOf(),
      endTime: endDate.valueOf(),
    });
    const searchParameters = {
      logset_id: data.logsetId,
      topic_ids: data.topicId,
      start_time: startDate.format(TimeFormat),
      end_time: endDate.format(TimeFormat),
      // query_string 必须用 cam 特有的 url 编码方式
      query_string: sql,
      limit: data.limit || 10,
      sort: 'desc',
    };
    const { results = [] } = await clsClient.searchLog(searchParameters);
    const logs = [];
    for (let i = 0, len = results.length; i < len; i++) {
      const curReq = results[i];
      const detailLog = await this.getLogDetail({
        logsetId: data.logsetId,
        topicId: data.topicId,
        reqId: curReq.requestId,
        startTime: startDate.format(TimeFormat),
        endTime: endDate.format(TimeFormat),
      });
      curReq.message = (detailLog || [])
        .map(({ content }: { content: string }) => {
          try {
            const info = JSON.parse(content) as LogContent;
            if (info.SCF_Type === 'Custom') {
              curReq.memoryUsage = info.SCF_MemUsage;
              curReq.duration = info.SCF_Duration;
            }
            return info.SCF_Message;
          } catch (e) {
            return '';
          }
        })
        .join('');
      logs.push(curReq);
    }
    return logs;
  }
  async getLogDetail(data: GetLogDetailOptions) {
    const clsClient = new ClsClient({
      region: this.region,
      secretId: this.credentials.SecretId!,
      secretKey: this.credentials.SecretKey!,
      token: this.credentials.Token,
      debug: false,
    });

    data.startTime = data.startTime || dayjs(data.endTime).add(-1, 'hour').format(TimeFormat);

    const sql = `SCF_RequestId:${data.reqId} AND SCF_RetryNum:0`;
    const searchParameters = {
      logset_id: data.logsetId,
      topic_ids: data.topicId,
      start_time: data.startTime as string,
      end_time: data.endTime,
      // query_string 必须用 cam 特有的 url 编码方式
      query_string: sql,
      limit: 100,
      sort: 'asc',
    };
    const { results = [] } = await clsClient.searchLog(searchParameters);
    return results;
  }
}
