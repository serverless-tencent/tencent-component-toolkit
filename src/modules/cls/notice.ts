import { Capi } from '@tencent-sdk/capi';
import { CreateNoticeOptions, NoticeInfo, NoticeDetail } from './interface';
import APIS, { ActionType } from './apis';
import { pascalCaseProps, camelCaseProps } from '../../utils';
import { ApiError } from '../../utils/error';
import { ApiServiceType, CapiCredentials, RegionType } from '../interface';
import { formatNoticeOptions } from './utils';

export default class Notice {
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
   * 获取通知详情
   * @param options 通知 id 或者 name
   * @returns 通知详情
   */
  async get({ id, name }: { id?: string; name?: string }): Promise<NoticeDetail | null> {
    if (!id && !name) {
      throw new ApiError({
        type: 'PARAMETER_ERROR',
        message: `Notice id or name is required`,
      });
    }
    let filter = {
      Key: 'name',
      Values: [name],
    };
    if (id) {
      filter = {
        Key: 'alarmNoticeId',
        Values: [id],
      };
    }
    const { AlarmNotices = [] }: { AlarmNotices: NoticeInfo[] } = await this.request({
      Action: 'DescribeAlarmNotices',
      Filters: [filter],
      Offset: 0,
      Limit: 100,
    });

    const detail = AlarmNotices.find((item) => item.Name === name || item.AlarmNoticeId === id);
    if (detail) {
      return camelCaseProps(detail as NoticeInfo);
    }
    return null;
  }

  async create(options: CreateNoticeOptions): Promise<CreateNoticeOptions & { id: string }> {
    const detail = await this.get({ name: options.name });

    const newOptions = formatNoticeOptions(options);
    let id = '';
    if (detail) {
      id = detail.alarmNoticeId;
      await this.request({
        Action: 'ModifyAlarmNotice',
        AlarmNoticeId: id,
        ...newOptions,
      });
    } else {
      const { AlarmNoticeId } = await this.request({
        Action: 'CreateAlarmNotice',
        ...newOptions,
      });
      id = AlarmNoticeId;
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
        message: `Notice id or name is required`,
      });
    }
    if (id) {
      const detail = await this.get({ id });
      if (detail) {
        await this.request({
          Action: 'DeleteAlarmNotice',
          AlarmNoticeId: id,
        });
      } else {
        console.log(`Notice ${id} not exist`);
      }
    }
    if (name) {
      const detail = await this.get({ name });
      if (detail) {
        await this.request({
          Action: 'DeleteAlarmNotice',
          AlarmNoticeId: detail.alarmNoticeId,
        });
      } else {
        console.log(`Notice ${name} not exist`);
      }
    }
    return true;
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, pascalCaseProps(data));
    return result;
  }
}
