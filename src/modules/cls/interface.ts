import { RegionType, CamelCasedProps } from './../interface';
import { DeployDashboardInputs } from './dashboard';

export interface CreateAlarmOptions {
  // 告警 ID
  id?: string;
  // 告警名称，唯一
  name: string;
  // 通知模板 ID
  noticeId: string;
  // 日志集 ID
  logsetId: string;
  // 主题 ID
  topicId: string;
  // 监控对象
  targets: {
    period?: number;
    query: string;
  }[];
  // 监控周期
  monitor?: {
    type: string;
    time: number;
  };
  // 告警策略
  trigger: {
    // 触发条件
    condition: string;
    // 持续周期
    count?: number;
    // 告警频率
    period?: number;
  };
  // 是否开启
  status?: boolean;
}

export type CreateAlarmResult = CreateAlarmOptions;

export interface MonitorTime {
  Type: string;
  Time: number;
}

export interface CallBackInfo {
  Body: string;
  Headers?: string[];
}

// 云 API 返回的 alarm target
export interface AlarmTargetItem {
  TopicId: string;
  Query: string;
  Number: string;
  StartTimeOffset: string;
  EndTimeOffset: string;
  LogsetId: string;
}

// 云 API 返回的 alerm 信息
export interface AlarmInfo {
  Name: string;
  AlarmTargets: AlarmTargetItem[];
  MonitorTime: MonitorTime;
  Condition: string;
  TriggerCount: number;
  AlarmPeriod: number;
  AlarmNoticeIds: string[];
  Status: boolean;
  AlarmId: string;
  CreateTime: string;
  UpdateTime: string;
  MessageTemplate: string;
  CallBack: CallBackInfo;
}

// get 方法返回的 camelCase 属性的 alerm 信息
export type AlarmDetail = CamelCasedProps<AlarmInfo>;

type NoticeChannel = 'Email' | 'Sms' | 'WeChat' | 'Phone';
export interface ReceiverOptions {
  // 开始时间
  start: string;
  // 结束时间
  end: string;
  // 接受对象类型：Uin - 用户，Group - 用户组
  type: 'Uin' | 'Group';
  // 用户/用户组列表
  ids: number[] | string[];
  // 接受渠道
  channels: NoticeChannel[];
}

export interface WebCallbackOptions {
  // webhook 类型：WeCom - 企业微信机器人，Http - 自定义
  type: 'WeCom' | 'Http';
  // 请求地址
  url: string;
  // 请求内容，字符串或者 JSON 格式
  body: string;
  // 请求头，Http 类型必须
  headers?: string[];
  // 请求防范，Http 类型必须
  method?: string;
}

// 创建通知模板的参数
export interface CreateNoticeOptions {
  id?: string;
  // 通知模板名称
  name: string;
  type: 'Trigger' | 'Recovery' | 'All';
  receivers: ReceiverOptions[];
  webCallbacks: WebCallbackOptions[];
}

// 创建通知模板的返回值
export type CreateNoticeResult = CreateNoticeOptions;

export interface Receiver {
  ReceiverChannels: NoticeChannel[];
  ReceiverIds: number[];
  EndTime: string;
  ReceiverType: string;
  StartTime: string;
}

export interface WebCallback {
  Body: string;
  CallbackType: 'WeCom' | 'Http';
  Headers: null | string[];
  Method: null | string;
  Url: string;
}

// 云 API 返回的通知模板
export interface NoticeInfo {
  AlarmNoticeId: string;
  Name: string;
  NoticeReceivers: Receiver[];
  CreateTime: string;
  WebCallbacks: WebCallback[];
}

export type NoticeDetail = CamelCasedProps<NoticeInfo>;

export interface DeployLogsetInputs {
  name?: string;
  period?: number;
  logsetId?: string;
}

export interface DeployTopicInputs {
  name?: string;
  period?: number;
  logsetId?: string;
  topic?: string;
  topicId?: string;
}

export interface DeployIndexInputs {
  topicId?: string;
  effective?: boolean;
  indexRule?: {
    fullText: {
      caseSensitive: boolean;
      tokenizer: string;
    };
    keyValue?: {
      caseSensitive: boolean;
      keys: {
        key: string;
        type: string;
        sqlFlag: boolean;
        tokenizer: string;
      }[];
    };
  };
}

export interface AlarmInputs {
  id?: string;
  // 告警名称，唯一
  name: string;
  // 通知模板 ID
  noticeId: string;
  // 监控对象
  targets: {
    period?: number;
    query: string;
  }[];
  // 监控周期
  monitor?: {
    type: string;
    time: number;
  };
  // 告警策略
  trigger: {
    // 触发条件
    condition: string;
    // 持续周期
    count?: number;
    // 告警频率
    period?: number;
  };
  // 是否开启
  status?: boolean;
}
export interface DeployInputs extends DeployLogsetInputs, DeployTopicInputs, DeployIndexInputs {
  region?: RegionType;
  name?: string;
  topic?: string;
  alarms?: AlarmInputs[];
  dashboards?: DeployDashboardInputs[];
}

export interface DeployOutputs extends Partial<DeployInputs> {
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
