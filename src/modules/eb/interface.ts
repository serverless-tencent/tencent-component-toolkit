import { RegionType } from '../interface';

export type EventBusType = 'Cloud' | 'Custom';
export type EventConnectionType = 'apigw' | 'tdmq';
export type ScfVersionType = '$DEFAULT' | '$LATEST';

export interface AccountLimitResponse {
  // 规则限制
  RulePerEventBusLimit: number;
  // 连机器限制
  ConnectionPerEventBusLimit: number;
  // 事件集限制
  EventBusLimit: number;
  // 目标限制
  TargetPerRuleLimit: number;
}

export interface EventBusBaseInfo {
  // 事件集名称，只能包含字母、数字、下划线、连字符，以字母开头，以数字或字母结尾，2~60个字符
  eventBusName?: string;
  // 事件集类型，支持云服务和自定义，取值范围Cloud、Custom
  type?: EventBusType;
  // 事件集描述，不限字符类型，200字符描述以内
  description?: string;
}

export interface EventBusCreateOutputs {
  type: string;
  eventBusId?: string;
  eventBusName?: string;
  description?: string;
}

export interface EventBusDetail {
  EventBusName?: string;
  Type?: EventBusType;
  Description?: string;
  // 更新时间
  ModTime: number;
  // 日志主题ID
  ClsTopicId?: string;
  // 创建时间
  AddTime: number;
  // 日志集ID
  ClsLogsetId: string;
  // 事件集ID
  EventBusId: string;
}

export interface EventBusUpdateInputs {
  eventBusId?: string;
  eventBusName?: string;
  description?: string;
}

export interface EventBusListResponse {
  // 事件集信息
  EventBuses: EventBusDetail[];
  // 事件集总数
  TotalCount: number;
}

export interface EventBusCreateOrUpdateOutputs extends EventBusBaseInfo {
  eventBusId?: string;
}

export interface ConnectionAPIGWParams {
  // HTTPS
  Protocol: string;
  // POST
  Method: string;
}

export interface EventConnectionDescription {
  // 资源qcs六段式，更多参考 资源六段式
  ResourceDescription: string;
  // apigw参数。 注意：此字段可能返回 null，表示取不到有效值。
  APIGWParams: ConnectionAPIGWParams;
}

export interface EventConnectionCreateInputs {
  eventBusId: string;
  connectionName: string;
  connectionDescription?: {
    resourceDescription?: string;
    gwParams?: {
      Protocol: string;
      Method: string;
    };
  };
  uin?: string;
  description?: string;
  enable?: boolean;
  type?: string;
}

export interface EventConnectionDetail {
  // 事件集ID
  EventBusId: string;
  // 连接器名称
  ConnectionName: string;
  // 连接器描述
  ConnectionDescription: EventConnectionDescription;
  // 描述
  Description?: string;
  // 使能开关
  Enable?: boolean;
  // 类型
  Type?: string;
  // 连接器ID
  ConnectionId: string;
  // 状态
  Status: string;
}

export interface EventConnectionListResponse {
  Connections: EventConnectionDetail[];
  TotalCount: number;
}

export interface EventConnectionUpdateInfo {
  eventBusId: string;
  connectionId: string;
  connectionName?: string;
  description?: string;
}

export interface EventConnectionOutputs {
  connectionId?: string;
  connectionDescription?: EventConnectionDescription;
  connectionName?: string;
  type?: string;
}

interface TargetBrief {
  // 目标ID
  TargetId: string;
  // 目标类型
  Type: string;
}

export interface EventRuleDetail {
  // 事件规则状态
  Status: string;
  // 更新时间
  ModTime: number;
  // 使能开关
  Enable: boolean;
  // 事件规则描述
  Description: string;
  // 事件规则id
  RuleId: string;
  // 创建时间
  AddTime: string;
  // 事件模式
  EventPattern: string;
  // 事件集id
  EventBusId: string;
  // 事件规则名称
  RuleName: string;
  // 事件规则类型
  Type: string;
  // 事件目标列表
  Targets: TargetBrief[];
}

export interface EventRuleListResponse {
  Rules: EventRuleDetail[];
  TotalCount: number;
}

export interface EventRuleCreateInputs {
  // 事件规则名称
  ruleName: string;
  // 参考：事件模式
  eventPattern: string;
  eventBusId: string;
  enable?: boolean;
  description?: string;
  // 事件规则类型，支持云服务和自定义，取值范围Cloud、Custom。
  type?: EventBusType;
}

export interface EventRuleOutputs {
  ruleId: string;
  eventBusId: string;
  ruleName: string;
  eventPattern: string;
  type?: string;
  description?: string;
}

export interface EventRuleUpdateInfo {
  ruleId: string;
  eventBusId: string;
  eventPattern: string;
  ruleName: string;
  description?: string;
}

interface EventTargetDetail {
  // 目标类型
  Type: string;
  // 事件集ID
  EventBusId: string;
  // 目标ID
  TargetId: string;
  // 目标描述
  TargetDescription: {
    // qcs资源六段式
    ResourceDescription: string;
  };
  // 事件规则ID
  RuleId: string;
}

export interface EventTargetListResponse {
  Targets: EventTargetDetail[];
  TotalCount: number;
}

export interface EventTargetCreateInputs {
  // 事件集ID
  eventBusId: string;
  // 目标类型: 云函数触发(scf)
  type: string;
  // 目标描述
  targetDescription: {
    resourceDescription: string;
  };
  // 事件规则ID
  ruleId: string;
}

export interface EventTargetOutputs {
  targetId: string;
  ruleId: string;
  type: string;
  targetDescription: {
    resourceDescription: string;
  };
}

export interface EventConnectionItem {
  eventBusId?: string;
  connectionId?: string;
  connectionName: string;
  connectionDescription?: {
    resourceDescription: string;
    gwParams: {
      Protocol: string;
      Method: string;
    };
  };
  description?: string;
  enable?: boolean;
  type?: EventConnectionType;
}

export interface EventTargetItem {
  targetId?: string;
  type?: string;
  functionName: string;
  functionNamespace: string;
  functionVersion: ScfVersionType;
}

interface EventRuleItem {
  ruleId?: string;
  ruleName?: string;
  eventPattern?: string;
  enable?: boolean;
  description?: string;
  type?: EventBusType;
  targets?: EventTargetItem[];
}

export interface EbDeployInputs extends EventBusBaseInfo {
  uin: string;
  region: RegionType;
  eventBusId?: string;
  connections?: EventConnectionItem[];
  rules?: EventRuleItem[];
}

export interface EventRuleDeployOutputs {
  ruleId: string;
  ruleName: string;
  eventPattern: string;
  type: EventBusType;
  description?: string;
  targets: EventTargetOutputs[];
}

export interface EbDeployOutputs extends EventBusBaseInfo {
  uin: string;
  region: RegionType;
  eventBusId: string;
  connections: EventConnectionOutputs[];
  rules: EventRuleDeployOutputs[];
}
