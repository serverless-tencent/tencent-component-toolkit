import { CapiCredentials, RegionType, ApiServiceType } from './../interface';
import { Capi } from '@tencent-sdk/capi';
import Apis from './apis';

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

  async request({ Action, ...data }: {Action: string, [key:string]:any}) {
    const result = await Apis[Action](this.capi, data);
    return result;
  }

  /**  */
  async DescribeRoleList(page: number, limit:number) {
    const reqParams = {
      Action: 'DescribeRoleList',
      Page: page,
      Rp: limit,
    };
    return this.request(reqParams);
  }

  async ListRolePoliciesByRoleId(roleId: string, page: number, limit: number) {
    const reqParams = {
      Action: 'ListAttachedRolePolicies',
      Page: page,
      Rp: limit,
      RoleId: roleId,
    };
    return this.request(reqParams);
  }

  /** 创建角色 */
  async CreateRole(roleName: string, policiesDocument: string) {
    const reqParams = {
      Action: 'CreateRole',
      RoleName: roleName,
      PolicyDocument: policiesDocument,
      Description: 'Created By Serverless Framework',
    };
    return this.request(reqParams);
  }

  /** 获取角色 */
  async GetRole(roleName: string) {
    return this.request({
      Action: 'GetRole',
      RoleName: roleName,
    });
  }

  /** 删除角色 */
  async DeleteRole(roleName: string) {
    return this.request({
      Action: 'DeleteRole',
      RoleName: roleName,
    });
  }

  // api limit qps 3/s
  async AttachRolePolicyByName(roleId: string, policyName:string) {
    const reqParams = {
      Action: 'AttachRolePolicy',
      AttachRoleId: roleId,
      PolicyName: policyName,
    };
    return this.request(reqParams);
  }

  async isRoleExist(roleName: string) {
    const { List = [] } = await this.DescribeRoleList(1, 200);

    for (var i = 0; i < List.length; i++) {
      const roleItem = List[i];

      if (roleItem.RoleName === roleName) {
        return true;
      }
    }
    return false;
  }

  async CheckSCFExcuteRole() {
    return this.isRoleExist('QCS_SCFExcuteRole');
  }
}
