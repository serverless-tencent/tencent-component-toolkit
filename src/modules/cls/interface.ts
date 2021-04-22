import { IndexRule } from '@tencent-sdk/cls/dist/typings';
import { RegionType } from './../interface';
export interface ClsDeployLogsetInputs {
  name?: string;
  period?: number;
  logsetId?: string;
}

export interface ClsDeployTopicInputs {
  name?: string;
  period?: number;
  logsetId?: string;
  topic?: string;
  topicId?: string;
}

export interface ClsDelopyIndexInputs {
  topicId?: string;
  effective?: boolean;
  rule?: IndexRule;
}

export interface ClsDeployInputs
  extends ClsDeployLogsetInputs,
    ClsDeployTopicInputs,
    ClsDelopyIndexInputs {
  region?: RegionType;
  name?: string;
  topic?: string;
}

export interface ClsDeployOutputs extends Partial<ClsDeployInputs> {
  region: RegionType;
}

export interface StatusSqlMapEnum {
  success: string;
  fail: string;
  retry: string;
  interrupt: string;
  timeout: string;
  exceed: string;
  codeError: string;
}

export interface GetSearchSqlOptions {
  // 函数名称
  functionName: string;
  // 命名空间
  namespace?: string;
  // 函数版本
  qualifier?: string;
  // 开始时间
  startTime?: number | string;
  // 结束时间
  endTime?: number | string;
  // 请求 ID
  reqId?: string;
  // 日志状态
  status?: keyof StatusSqlMapEnum | '';

  // 查询条数
  limit?: number;
}

export type GetLogOptions = Omit<GetSearchSqlOptions, 'startTime'> & {
  logsetId: string;
  topicId: string;
  // 时间间隔，单位秒，默认为 3600s
  interval?: string | number;
};

export type GetLogDetailOptions = {
  logsetId: string;
  topicId: string;
  reqId: string;
  // 开始时间
  startTime?: string;
  // 结束时间
  endTime: string;
};

export interface LogContent {
  // 函数名称
  SCF_FunctionName: string;
  // 命名空间
  SCF_Namespace: string;
  // 开始时间
  SCF_StartTime: string;
  // 请求 ID
  SCF_RequestId: string;
  // 运行时间
  SCF_Duration: string;
  // 别名
  SCF_Alias: string;
  // 版本
  SCF_Qualifier: string;
  // 日志时间
  SCF_LogTime: string;
  // 重试次数
  SCF_RetryNum: string;
  // 使用内存
  SCF_MemUsage: string;
  // 日志等级
  SCF_Level: string;
  // 日志信息
  SCF_Message: string;
  // 日志类型
  SCF_Type: string;
  // 状态吗
  SCF_StatusCode: string;
}
