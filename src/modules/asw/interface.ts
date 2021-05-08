export interface CreateApiOptions {
  // 状态机定义文本，执行步骤（JSON格式）
  Definition: string;
  // 状态机服务名称，必须唯一
  FlowServiceName: string;
  // 是否是新创建角色
  IsNewRole: boolean;
  // 状态机类型，EXPRESS，STANDARD
  Type: string;
  // 状态机服务中文名称
  FlowServiceChineseName: string;
  // 备注
  Description: string;
  // 是否开启 CLS 日志投递功能
  EnableCLS: boolean;
  // 角色资源名，6段式
  RoleResource?: string;
  // 状态机默认输入参数
  Input?: string;
}

export type UpdateApiOptions = CreateApiOptions & {
  // 状态机名称，唯一性 ID，create 方法返回的 resourceId
  FlowServiceResource: string;
};

export interface CreateOptions {
  // 状态机定义文本，执行步骤（JSON格式）
  definition: string;
  // 状态机服务名称，必须唯一
  name: string;
  // 是否是新创建角色
  isNewRole?: boolean;
  // 角色名称
  role?: string;
  // 状态机类型，EXPRESS，STANDARD
  type?: string;
  // 状态机服务中文名称
  chineseName?: string;
  // 备注
  description?: string;
  // 是否开启 CLS 日志投递功能
  enableCls?: boolean;
  // 状态机默认输入参数
  input?: string;
}

export interface UpdateOptions extends CreateOptions {
  // 状态机资源 ID
  resourceId: string;
}

export interface BaseResult {
  // 请求 ID
  requestId: string;
  // 状态机资源 ID
  resourceId: string;
}

export interface CreateResult extends BaseResult {
  // 是否是新建角色
  isNewRole: boolean;
  // 角色名称
  roleName: string;
}
export type UpdateResult = BaseResult & {
  isNewRole: boolean;
  roleName: string;
};
export type DeleteResult = BaseResult;

export interface ExecuteOptions {
  // 状态机资源 ID
  resourceId: string;
  // 本次执行名称
  name?: string;
  // 输入参数，JSON 字符串
  input?: string;
}
export interface ExecuteApiOptions {
  // 状态机资源名称，create 方法获取的 resourceId
  StateMachineResourceName: string;
  // 输入参数，JSON 字符串
  Input?: string;
  // 本次执行的名称，如果定义了，需要保证名称唯一
  Name?: string;
}
export type ExecuteResult = BaseResult & {
  // 执行名称，唯一性 ID
  executeName: string;
};
export interface StopResult {
  // 请求 ID
  requestId: string;
  // 执行名称，唯一性 ID
  executeName: string;
}
export interface ExecuteState {
  // 执行资源名
  ExecutionResourceName: string;
  // 资源名称
  Name: string;
  // 执行开始时间，毫秒
  StartDate: string;
  // 执行结束时间，毫秒
  StopDate: string;
  // 状态机资源名
  StateMachineResourceName: string;
  // 执行状态。INIT，RUNNING，SUCCEED，FAILED，TERMINATED
  Status: string;
  // 执行的输入
  Input: string;
  // 执行的输出
  Output: string;
  // 启动执行时，状态机的定义
  ExecutionDefinition: string;
  // 请求 ID
  RequestId: string;
}
