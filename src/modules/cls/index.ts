import { Cls as ClsClient } from '@tencent-sdk/cls';
import {
  DeployIndexInputs,
  DeployInputs,
  DeployLogsetInputs,
  DeployOutputs,
  DeployTopicInputs,
  GetLogOptions,
  GetLogDetailOptions,
  LogContent,
  AlarmInputs,
} from './interface';
import { CapiCredentials, RegionType } from './../interface';
import { ApiError } from '../../utils/error';
import { dtz, TIME_FORMAT, Dayjs } from '../../utils/dayjs';
import { createLogset, createTopic, updateIndex, getSearchSql } from './utils';
import Alarm from './alarm';
import { ClsDashboard } from './dashboard';

export default class Cls {
  credentials: CapiCredentials;
  region: RegionType;
  clsClient: ClsClient;
  alarm: Alarm;
  dashboard: ClsDashboard;

  constructor(credentials: CapiCredentials, region: RegionType = 'ap-guangzhou', expire?: number) {
    this.region = region;
    this.credentials = credentials;
    this.clsClient = new ClsClient({
      region: this.region,
      secretId: credentials.SecretId!,
      secretKey: credentials.SecretKey!,
      token: credentials.Token,
      debug: false,
      expire: expire,
    });

    this.alarm = new Alarm(credentials, this.region);
    this.dashboard = new ClsDashboard(this);
  }

  // 创建/更新 日志集
  async deployLogset(inputs: DeployLogsetInputs = {} as any) {
    const outputs = {
      region: this.region,
      name: inputs.name,
      period: inputs.period,
      logsetId: '',
    };
    let exist = false;
    const { logsetId } = inputs;
    if (logsetId) {
      const detail = await this.clsClient.getLogset({
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
        const res = await this.clsClient.updateLogset({
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
      const res = await createLogset(this.clsClient, {
        name: inputs.name!,
        period: inputs.period!,
      });
      outputs.logsetId = res?.logset_id;
    }

    return outputs;
  }

  // 创建/更新 主题
  async deployTopic(inputs: DeployTopicInputs) {
    const outputs = {
      region: this.region,
      name: inputs.topic,
      topicId: '',
    };
    let exist = false;
    const { topicId } = inputs;
    if (topicId) {
      const detail = await this.clsClient.getTopic({
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
        const res = await this.clsClient.updateTopic({
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
      const res = await createTopic(this.clsClient, {
        logsetId: inputs.logsetId!,
        name: inputs.topic!,
      });
      outputs.topicId = res.topic_id;
    }

    return outputs;
  }

  // 更新索引
  async deployIndex(inputs: DeployIndexInputs) {
    if (inputs.indexRule) {
      console.log('Deploying index');

      const { fullText, keyValue } = inputs.indexRule!;
      let parsedFullText;
      let parsedKeyValue: any;
      if (fullText) {
        parsedFullText = {
          case_sensitive: fullText.caseSensitive,
          tokenizer: fullText.tokenizer,
        };
        parsedKeyValue = {
          case_sensitive: keyValue?.caseSensitive!,
          keys: keyValue?.keys?.map((v) => v.key) ?? [],
          types: keyValue?.keys?.map((v) => v.type) ?? [],
          sql_flags: keyValue?.keys?.map((v) => v.sqlFlag) ?? [],
          tokenizers: keyValue?.keys.map((v) => v.tokenizer) ?? [],
        };
      }
      try {
        await updateIndex(this.clsClient, {
          topicId: inputs.topicId!,
          // FIXME: effective is always true in updateIndex
          effective: inputs.effective !== false ? true : false,
          rule: {
            full_text: parsedFullText,
            key_value: parsedKeyValue,
          },
        });
      } catch (err) {
        console.log('' + err);
        if (err.message.includes('403')) {
          console.log('Cant update index of CLS for SCF');
        } else {
          throw err;
        }
      }

      // TODO: SCF Logset 403
    }
  }

  // 部署
  async deploy(inputs: DeployInputs = {}) {
    const outputs: DeployOutputs = {
      region: this.region,
      name: inputs.name,
      topic: inputs.topic,
    };

    const logsetOutput = await this.deployLogset(inputs);
    outputs.logsetId = inputs.logsetId = logsetOutput.logsetId;
    const topicOutput = await this.deployTopic(inputs);
    outputs.topicId = inputs.topicId = topicOutput.topicId;
    await this.deployIndex(inputs);

    // 部署告警
    const { alarms = [] } = inputs;
    if (alarms.length > 0) {
      outputs.alarms = [];
      for (let i = 0, len = alarms.length; i < len; i++) {
        const res = await this.alarm.create({
          ...alarms[i],
          logsetId: outputs.logsetId,
          topicId: outputs.topicId,
        });
        outputs.alarms.push(res);
      }
    }

    const { dashboards = [] } = inputs;
    if (dashboards.length > 0) {
      outputs.dashboards = [];
      for (let i = 0; i < dashboards.length; i++) {
        const res = await this.dashboard.deploy(dashboards[i], {
          region: outputs.region,
          logsetId: outputs.logsetId,
          topicId: outputs.topicId,
        });
        outputs.dashboards.push(res);
      }
    }

    return outputs;
  }

  // 删除
  async remove(inputs: { topicId?: string; logsetId?: string; alarms?: AlarmInputs[] } = {}) {
    try {
      console.log(`Start removing cls`);
      console.log(`Removing cls topic id ${inputs.topicId}`);
      const res1 = await this.clsClient.deleteTopic({
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
      const res2 = await this.clsClient.deleteLogset({
        logset_id: inputs.logsetId!,
      });
      if (res2.error) {
        throw new ApiError({
          type: 'API_deleteLogset',
          message: res2.error.message,
        });
      }
      const { alarms = [] } = inputs;
      if (alarms && alarms.length > 0) {
        for (let i = 0, len = alarms.length; i < len; i++) {
          const cur = alarms[i];
          console.log(`Removing alarm name ${cur.name}, id ${cur.id}`);
          await this.alarm.delete({ id: cur.id, name: cur.name });
          console.log(`Remove alarm name ${cur.name}, id ${cur.id} success`);
        }
      }
      console.log(`Removed cls id ${inputs.logsetId} success`);
    } catch (e) {
      console.log(e);
    }

    return {};
  }

  // 获取日志列表
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
      endDate = dtz();
      startDate = endDate.add(-1, 'hour');
    } else {
      endDate = dtz(endTime);
      startDate = dtz(endDate.valueOf() - Number(interval) * 1000);
    }

    const sql = getSearchSql({
      ...data,
      startTime: startDate.valueOf(),
      endTime: endDate.valueOf(),
    });
    const searchParameters = {
      logset_id: data.logsetId,
      topic_ids: data.topicId,
      start_time: startDate.format(TIME_FORMAT),
      end_time: endDate.format(TIME_FORMAT),
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
        startTime: startDate.format(TIME_FORMAT),
        endTime: endDate.format(TIME_FORMAT),
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

  // 获取日志详情
  async getLogDetail(data: GetLogDetailOptions) {
    const clsClient = new ClsClient({
      region: this.region,
      secretId: this.credentials.SecretId!,
      secretKey: this.credentials.SecretKey!,
      token: this.credentials.Token,
      debug: false,
    });

    data.startTime = data.startTime || dtz(data.endTime).add(-1, 'hour').format(TIME_FORMAT);

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
