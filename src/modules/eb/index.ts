import { RegionType } from '../interface';
import { Capi } from '@tencent-sdk/capi';
import { getQcsResourceId, pascalCaseProps, randomId } from '../../utils';
import { CapiCredentials, ApiServiceType } from '../interface';
import APIS, { ActionType } from './apis';
import EventBusEntity from './entities/event-bus';
import ConnectionEntity from './entities/connection';
import RuleEntity from './entities/rule';
import TargetEntity from './entities/target';
import {
  AccountLimitResponse,
  EbDeployInputs,
  EbDeployOutputs,
  EventBusCreateOrUpdateOutputs,
  EventBusType,
  EventRuleDeployOutputs,
  EventTargetItem,
  EventTargetOutputs,
} from './interface';

export default class EventBridge {
  credentials: CapiCredentials;
  capi: Capi;
  region: RegionType;
  // 事件集
  eventBus: EventBusEntity;
  // 事件连接器
  connection: ConnectionEntity;
  // 事件规则
  rule: RuleEntity;
  // 事件目标
  target: TargetEntity;

  constructor(credentials: CapiCredentials, region: RegionType = 'ap-guangzhou') {
    this.credentials = credentials;
    this.region = region;
    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.eb,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });
    this.eventBus = new EventBusEntity(this.capi);
    this.connection = new ConnectionEntity(this.capi, this.region);
    this.rule = new RuleEntity(this.capi);
    this.target = new TargetEntity(this.capi);
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, pascalCaseProps(data));
    return result as never;
  }

  /** 查询账户配额 -- 事件集配额 */
  async getAccountLimit() {
    try {
      const res: AccountLimitResponse = await this.request({ Action: 'GetAccountLimit' as const });
      console.log(res);

      return res?.EventBusLimit || 0;
    } catch (e) {
      console.log(e.message);
      return 0;
    }
  }

  async bindConnections(eventBusId: string, inputs: EbDeployInputs) {
    const connectionList = [];
    if (inputs?.connections && inputs.connections.length > 0) {
      for (const connInput of inputs.connections) {
        let conn;
        if (connInput?.connectionId) {
          // TODO: 由于更新接口的问题，暂时无法更新
          // 连接器更新接口只支持修改名字和描述
          conn = await this.connection.update({
            eventBusId: eventBusId,
            connectionId: connInput.connectionId,
            connectionName: connInput.connectionName,
            description: connInput.description,
          });
        } else {
          conn = await this.connection.create({
            eventBusId,
            connectionName: connInput?.connectionName,
            connectionDescription: {
              resourceDescription: connInput.connectionDescription?.resourceDescription,
              gwParams: connInput.connectionDescription?.gwParams,
            },
            uin: inputs.uin,
            description: connInput.description,
            type: connInput.type,
          });
        }
        connectionList.push(conn);
      }
    } else {
      // 无配置情况下，默认新建一个连接器
      const singleConn = await this.connection.create({
        uin: inputs?.uin,
        eventBusId,
        connectionName: `conn-${randomId(8)}`,
      });
      connectionList.push(singleConn);
    }
    return connectionList;
  }

  async bindTargets(
    eventBusId: string,
    confTargets: EventTargetItem[],
    ruleId: string,
    uin: string,
  ) {
    const targetList: EventTargetOutputs[] = [];
    const existTargets = await this.target.list(eventBusId, ruleId);
    const tempTargets = confTargets.map((item: any) => {
      // e.g: "qcs::scf:ap-guangzhou:uin/100014475911:namespace/default/function/helloworld-1622536829/$DEFAULT"
      const resource = getQcsResourceId(
        'scf',
        this.region,
        uin,
        `namespace/${item.functionNamespace || 'default'}/function/${item.functionName}/${
          item.functionVersion || '$DEFAULT'
        }`,
      );
      item.resourceId = resource;
      const existTarget = existTargets.Targets.find(
        (temp: any) => temp?.TargetDescription?.ResourceDescription === resource,
      );
      if (existTarget) {
        item.existTarget = existTarget;
      }
      return item;
    });
    // 已绑定过的目标直接返回，未绑定则新建
    for (const targetInput of tempTargets) {
      let target;
      if (targetInput?.existTarget) {
        target = {
          targetId: targetInput.existTarget.TargetId,
          ruleId: targetInput.existTarget.RuleId,
          targetDescription: targetInput.existTarget.TargetDescription,
          type: targetInput.existTarget.Type,
        };
      } else {
        target = await this.target.create({
          eventBusId: eventBusId,
          ruleId: ruleId,
          targetDescription: { resourceDescription: targetInput.resourceId },
          type: 'scf',
        });
      }
      targetList.push(target);
    }

    // 删除之前已绑定的目标列表中，但不在本次配置中的目标
    const needRemoveTargets = existTargets.Targets.filter((item: any) => {
      const isInCurrentConf = tempTargets.find(
        (temp) => item?.TargetDescription?.ResourceDescription === temp.resourceId,
      );
      return !isInCurrentConf;
    });
    if (needRemoveTargets.length > 0) {
      for (const removeTarget of needRemoveTargets) {
        await this.target.delete(eventBusId, ruleId, removeTarget.TargetId);
      }
    }

    return targetList;
  }

  async deployRules(eventBusId: string, inputs: EbDeployInputs, type?: string) {
    const ruleList: EventRuleDeployOutputs[] = [];
    if (inputs?.rules && inputs.rules.length > 0) {
      for (const ruleInput of inputs.rules) {
        // 注：规则中的事件目标需要指定已有函数，若无配置则无法部署规则
        if (ruleInput?.targets && ruleInput.targets.length > 0) {
          //  部署规则
          let rule;
          const tempRuleName = ruleInput?.ruleName || `rule-${randomId(8)}`;
          const tempPattern =
            ruleInput?.eventPattern || '{\n  "source": ["apigw.cloud.tencent"]\n}';
          if (ruleInput?.ruleId) {
            rule = await this.rule.update({
              ruleId: ruleInput.ruleId,
              eventBusId,
              eventPattern: tempPattern,
              ruleName: tempRuleName,
              description: ruleInput?.description,
            });
          } else {
            rule = await this.rule.create({
              ruleName: ruleInput.ruleName || `rule-${randomId(8)}`,
              eventPattern: tempPattern,
              eventBusId,
              description: ruleInput?.description,
              type: type as EventBusType,
            });
          }

          // 绑定事件目标到规则中
          const targetList = await this.bindTargets(
            eventBusId,
            ruleInput.targets,
            rule.ruleId,
            inputs.uin,
          );

          ruleList.push({
            ruleId: rule.ruleId,
            ruleName: rule.ruleName,
            eventPattern: rule.eventPattern,
            description: rule.description,
            type: rule.type as EventBusType,
            targets: targetList,
          });
        }
      }
    }
    return ruleList;
  }

  /** 部署EB */
  async deploy(inputs: EbDeployInputs) {
    // 部署事件集
    let eventOutputs: EventBusCreateOrUpdateOutputs;
    const limitation = await this.getAccountLimit();

    const eventInputs = {
      eventBusId: inputs.eventBusId,
      eventBusName: inputs.eventBusName,
      description: inputs.description,
    };
    if (inputs.eventBusId) {
      eventOutputs = await this.eventBus.update(eventInputs, limitation);
    } else {
      eventOutputs = await this.eventBus.create(eventInputs, limitation);
    }
    const { eventBusId, type, eventBusName, description } = eventOutputs;
    console.log(`Deploy eventbus ${eventBusId} success`);
    if (eventBusId) {
      // 绑定事件连接器
      const connectionList = await this.bindConnections(eventBusId, inputs);
      console.log(`Bind event connections success`);

      // 部署事件规则及其目标列表
      const ruleList: EventRuleDeployOutputs[] = await this.deployRules(eventBusId, inputs, type);
      console.log(`Deploy event rules success`);

      const outputs: EbDeployOutputs = {
        uin: inputs.uin,
        region: this.region,
        eventBusId: eventBusId,
        eventBusName: eventBusName,
        type: type,
        description: description,
        connections: connectionList,
        rules: ruleList,
      };
      return outputs;
    }
  }

  async remove(eventBusId: string) {
    // const { eventBusId } = inputs;
    if (eventBusId) {
      // 检查EB是否存在
      const existEb = await this.eventBus.getById(eventBusId);
      if (!existEb) {
        console.log(`Event bridge ${eventBusId} not exist`);
        return;
      }

      // 删除事件规则及其目标
      const existRules = await this.rule.list(eventBusId);
      if (existRules?.TotalCount > 0) {
        for (const rule of existRules.Rules) {
          if (rule?.Targets && rule.Targets.length > 0) {
            for (const target of rule.Targets) {
              await this.target.delete(eventBusId, rule.RuleId, target.TargetId);
            }
            console.log(`Removing event targets success`);
          }
          await this.rule.delete(eventBusId, rule.RuleId);
          console.log(`Removing event rules success`);
        }
      }
      // 删除连接器
      const existConnections = await this.connection.list(eventBusId);
      if (existConnections?.TotalCount > 0) {
        for (const conn of existConnections.Connections) {
          await this.connection.delete(eventBusId, conn.ConnectionId);
        }
        console.log(`Removing event connections success`);
      }
      // 删除事件集
      console.log(`Removing event bridge ${eventBusId}`);
      await this.eventBus.delete(eventBusId);
      console.log(`Remove event bridge ${eventBusId} success`);
    }
    return true;
  }
}

module.exports = EventBridge;
