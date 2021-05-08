import { ActionType } from './apis';
import { CapiCredentials, RegionType, ApiServiceType } from '../interface';
import { Capi } from '@tencent-sdk/capi';
import APIS from './apis';
import { AccountDetail } from './interface';

/** CAM （访问管理）for serverless */
export default class Cam {
  region: RegionType;
  credentials: CapiCredentials;
  capi: Capi;

  constructor(credentials: CapiCredentials, region: RegionType = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;

    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.cam,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, data);
    return result;
  }

  /**
   * 获取账号详情
   * @returns 账号详情
   */
  async get(): Promise<AccountDetail> {
    const res = await this.request({
      Action: 'DescribeCurrentUserDetails',
    });

    return {
      ownerUin: res.OwnerUin,
      uin: res.Uin,
      appId: res.AppId![0] || '',
      account: res.Account,
      userType: res.UserType,
      type: res.Type,
      area: res.Area,
      tel: res.Tel,
    };
  }
}
