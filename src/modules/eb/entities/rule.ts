import { Capi } from '@tencent-sdk/capi';
import APIS, { ActionType } from '../apis';
import { deepClone, pascalCaseProps } from '../../../utils';
import {
  EventRuleCreateInputs,
  EventRuleDetail,
  EventRuleListResponse,
  EventRuleOutputs,
  EventRuleUpdateInfo,
} from '../interface';
import { ApiError } from '../../../utils/error';

export default class RuleEntity {
  capi: Capi;

  constructor(capi: Capi) {
    this.capi = capi;
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, pascalCaseProps(data));
    return result as never;
  }

  async removeRequest({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    try {
      await APIS[Action](this.capi, pascalCaseProps(data));
    } catch (e) {
      console.warn(e);
    }
    return true;
  }

  /** 查询事件规则详情 */
  async getById(eventBusId: string, ruleId: string) {
    try {
      const detail: EventRuleDetail = await this.request({
        Action: 'GetRule',
        eventBusId,
        ruleId,
      });
      return detail;
    } catch (e) {
      throw new ApiError({
        type: 'API_EB_GetEventRuleById',
        message: `Get event rule id:${ruleId} failed: ${e?.message}`,
      });
    }
  }

  /** 查询事件规则列表 */
  async list(eventBusId: string) {
    try {
      const result: EventRuleListResponse = await this.request({
        Action: 'ListRules' as const,
        EventBusId: eventBusId,
      });
      return result;
    } catch (error) {
      throw new ApiError({
        type: 'API_EB_ListEventRules',
        message: `List event rules failed: ${error?.message}`,
      });
    }
  }

  /** 创建事件规则 */
  async create(ruleConf: EventRuleCreateInputs) {
    const {
      eventBusId,
      ruleName,
      eventPattern,
      type = 'Cloud',
      description = 'Created By Serverless',
    } = ruleConf;

    const apiInputs = {
      Action: 'CreateRule' as const,
      enable: true,
      eventBusId,
      ruleName,
      eventPattern,
      description,
      type,
    };
    try {
      const res: { RuleId: string } = await this.request(apiInputs);

      const outputs: EventRuleOutputs = {
        ruleId: res?.RuleId,
        eventBusId,
        ruleName,
        eventPattern,
        description,
        type,
      };
      console.log(`Create event rule ${ruleName} successfully`);
      return deepClone(outputs);
    } catch (error) {
      throw new ApiError({
        type: 'API_EB_CreateEventRule',
        message: `Create event rule failed: ${error?.message}`,
      });
    }
  }

  /** 更新事件规则 */
  async update(ruleConf: EventRuleUpdateInfo) {
    const { eventBusId, ruleId, eventPattern, ruleName, description } = ruleConf;

    let detail: EventRuleDetail | null;
    const outputs: EventRuleOutputs = { ruleId, eventBusId, ruleName, eventPattern };

    try {
      if (eventBusId && ruleId) {
        detail = await this.getById(eventBusId, ruleId);
        if (detail) {
          outputs.type = detail.Type;
          const apiInputs = {
            Action: 'UpdateRule' as const,
            eventBusId,
            ruleId,
            ruleName,
            eventPattern,
            description,
          };
          await this.request(apiInputs);
          console.log(`Update event rule ${ruleName} successfully`);
        }
      }

      return deepClone(outputs);
    } catch (error) {
      throw new ApiError({
        type: 'API_EB_UpdateEventRule',
        message: `Create event rule failed: ${error?.message}`,
      });
    }
  }

  /** 删除事件规则 */
  async delete(eventBusId: string, ruleId: string) {
    try {
      console.log(`Start removing event rule, id ${ruleId}...`);
      await this.request({
        Action: 'DeleteRule',
        EventBusId: eventBusId,
        RuleId: ruleId,
      });
      console.log(`Remove event rule, id ${ruleId} successfully`);
    } catch (e) {
      throw new ApiError({
        type: 'API_EB_RemoveEventRule',
        message: `Remove event rule id:${ruleId} failed: ${e?.message}`,
      });
    }

    return true;
  }
}
