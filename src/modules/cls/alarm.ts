import { Capi } from '@tencent-sdk/capi';
import { CreateAlarmOptions, AlarmInfo, AlarmDetail } from './interface';
import APIS, { ActionType } from './apis';
import { pascalCaseProps, camelCaseProps } from '../../utils';
import { ApiError } from '../../utils/error';
import { ApiServiceType, CapiCredentials, RegionType } from '../interface';
import { formatAlarmOptions } from './utils';

export default class Alarm {
  credentials: CapiCredentials;
  capi: Capi;
  region: RegionType;

  constructor(credentials: CapiCredentials, region: RegionType = 'ap-guangzhou') {
    this.credentials = credentials;
    this.region = region;

    this.capi = new Capi({
      Region: region,
      ServiceType: ApiServiceType.cls,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });
  }

  /**
   * 获取告警详情
   * @param options 告警 id 或者 name
   * @returns 告警详情
   */
  async get({ id, name }: { id?: string; name?: string }): Promise<AlarmDetail | null> {
    if (!id && !name) {
      throw new ApiError({
        type: 'PARAMETER_ERROR',
        message: `Alarm id or name is required`,
      });
    }
    let filter = {
      Key: 'name',
      Values: [name],
    };
    if (id) {
      filter = {
        Key: 'alarmId',
        Values: [id],
      };
    }
    const { Alarms = [] }: { Alarms: AlarmInfo[] } = await this.request({
      Action: 'DescribeAlarms',
      Filters: [filter],
      Offset: 0,
      Limit: 100,
    });
    const detail = Alarms.find((alarm) => alarm.Name === name || alarm.AlarmId === id);
    if (detail) {
      return camelCaseProps(detail as AlarmInfo);
    }
    return null;
  }

  async create(options: CreateAlarmOptions): Promise<CreateAlarmOptions & { id: string }> {
    const detail = await this.get({ name: options.name });
    const alarmOptions = formatAlarmOptions(options);
    let id = '';
    if (detail) {
      id = detail.alarmId;
      await this.request({
        Action: 'ModifyAlarm',
        AlarmId: id,
        ...alarmOptions,
      });
    } else {
      const { AlarmId } = await this.request({
        Action: 'CreateAlarm',
        ...alarmOptions,
      });
      id = AlarmId;
    }

    return {
      ...options,
      id,
    };
  }

  async delete({ id, name }: { id?: string; name?: string }) {
    if (!id && !name) {
      throw new ApiError({
        type: 'PARAMETER_ERROR',
        message: `Alarm id or name is required`,
      });
    }
    if (id) {
      const detail = await this.get({ id });
      if (detail) {
        await this.request({
          Action: 'DeleteAlarm',
          AlarmId: id,
        });
      } else {
        console.log(`Alarm ${id} not exist`);
      }
    }
    if (name) {
      const detail = await this.get({ name });
      if (detail) {
        await this.request({
          Action: 'DeleteAlarm',
          AlarmId: detail.alarmId,
        });
      } else {
        console.log(`Alarm ${name} not exist`);
      }
    }
    return true;
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, pascalCaseProps(data));
    return result;
  }
}
