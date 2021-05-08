import { Capi } from '@tencent-sdk/capi';
import { ApiServiceType } from '../interface';
import {
  CreateApiOptions,
  CreateOptions,
  CreateResult,
  DeleteResult,
  UpdateApiOptions,
  UpdateOptions,
  UpdateResult,
  ExecuteOptions,
  ExecuteApiOptions,
  ExecuteResult,
  ExecuteState,
} from './interface';
import APIS, { ActionType } from './apis';
import { pascalCaseProps, randomId } from '../../utils/index';
import { CapiCredentials, RegionType } from '../interface';
import { Account, Cam } from '../../';

export default class Asw {
  credentials: CapiCredentials;
  capi: Capi;
  region: RegionType;
  account: Account;
  cam: Cam;

  constructor(credentials: CapiCredentials, region: RegionType = 'ap-guangzhou') {
    this.credentials = credentials;
    this.region = region;

    this.capi = new Capi({
      Region: region,
      ServiceType: ApiServiceType.asw,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });

    this.account = new Account(credentials);

    this.cam = new Cam(credentials);
  }

  /**
   * 创建工作流
   * @param {CreateOptions} options 创建参数
   * @returns 工作流资源 ID
   */
  async create(options: CreateOptions): Promise<CreateResult> {
    const {
      definition,
      name,
      role,
      type = 'STANDARD',
      chineseName = 'serverless',
      description = 'Created By Serverless',
      enableCls = false,
      input,
    } = options;

    const reqParams: CreateApiOptions = {
      Definition: definition,
      FlowServiceName: name,
      IsNewRole: !!role,
      Type: type,
      FlowServiceChineseName: chineseName,
      Description: description,
      EnableCLS: enableCls,
    };

    let roleName = role;
    const { appId, ownerUin } = await this.account.get();

    if (!roleName) {
      roleName = await this.createRole(name, appId);
    }
    reqParams.RoleResource = `qcs::cam::uin/${ownerUin}:roleName/${roleName}`;

    if (input) {
      reqParams.Input = input;
    }
    const { RequestId, FlowServiceResource } = await this.request({
      ...reqParams,
      Action: 'CreateFlowService',
    });

    return {
      requestId: RequestId,
      resourceId: FlowServiceResource,
      isNewRole: reqParams.IsNewRole,
      roleName,
    };
  }

  /**
   * 更新工作流
   * @param {UpdateOptions} options 更新参数
   * @returns 工作流资源 ID
   */
  async update(options: UpdateOptions): Promise<UpdateResult> {
    const {
      resourceId,
      definition,
      name,
      role,
      type = 'STANDARD',
      chineseName = 'serverless',
      description = 'Created By Serverless',
      enableCls = false,
      input,
    } = options;

    const reqParams: UpdateApiOptions = {
      FlowServiceResource: resourceId,
      Definition: definition,
      FlowServiceName: name,
      IsNewRole: !!role,
      Type: type,
      FlowServiceChineseName: chineseName,
      Description: description,
      EnableCLS: enableCls,
    };

    let roleName = role;
    const { appId, ownerUin } = await this.account.get();

    if (!roleName) {
      roleName = await this.createRole(name, appId);
    }
    reqParams.RoleResource = `qcs::cam::uin/${ownerUin}:roleName/${roleName}`;

    if (input) {
      reqParams.Input = input;
    }
    const { RequestId, FlowServiceResource } = await this.request({
      ...reqParams,
      Action: 'ModifyFlowService',
    });

    return {
      requestId: RequestId,
      resourceId: FlowServiceResource,
      isNewRole: reqParams.IsNewRole,
      roleName,
    };
  }

  /**
   * 删除工作流
   * @param {string} resourceId 工作流资源 ID
   * @returns
   */
  async delete(resourceId: string): Promise<DeleteResult> {
    const { RequestId } = await this.request({
      Action: 'DeleteFlowService',
      FlowServiceResource: resourceId,
    });

    return {
      requestId: RequestId,
      resourceId,
    };
  }

  /**
   * 启动执行
   * @param {ExecuteOptions} options 启动参数
   * @returns
   */
  async execute({ resourceId, name = '', input = '' }: ExecuteOptions): Promise<ExecuteResult> {
    const reqParams: ExecuteApiOptions = {
      StateMachineResourceName: resourceId,
      Input: input,
      Name: name,
    };
    const { ExecutionResourceName, RequestId } = await this.request({
      ...reqParams,
      Action: 'StartExecution',
    });

    return {
      requestId: RequestId,
      resourceId,
      executeName: ExecutionResourceName,
    };
  }

  /**
   * 获取执行状态
   * @param executeName 执行名称
   * @returns 执行状态
   */
  async getExecuteState(executeName: string): Promise<ExecuteState> {
    const res = await this.request({
      Action: 'DescribeExecution',
      ExecutionResourceName: executeName,
    });

    return res as ExecuteState;
  }

  /**
   * 停止状态机
   * @param executeName 执行名称
   * @returns 停止请求结果
   */
  async stop(executeName: string) {
    const { RequestId } = await this.request({
      Action: 'StopExecution',
      ExecutionQrn: executeName,
    });

    return {
      requestId: RequestId,
      executeName,
    };
  }

  /**
   * 创建 ASW 角色
   * @param {string} name aws 服务名称
   * @param {string} appId 应用 ID
   * @returns {string} 角色名称
   */
  async createRole(name: string, appId: string) {
    const roleName = `${name}_${appId}_${randomId(8)}`;
    await this.cam.CreateRole(
      roleName,
      '{"version":"2.0","statement":[{"action":"name/sts:AssumeRole","effect":"allow","principal":{"service":["asw.qcloud.com"]}}]}',
    );
    return roleName;
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, pascalCaseProps(data));
    return result;
  }
}
