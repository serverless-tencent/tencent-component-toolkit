import { Capi } from '@tencent-sdk/capi';
import APIS, { ActionType } from '../apis';
import { deepClone, pascalCaseProps } from '../../../utils';
import { EventTargetCreateInputs, EventTargetListResponse, EventTargetOutputs } from '../interface';
import { ApiError } from '../../../utils/error';

export default class TargetEntity {
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

  /** 查询事件目标列表 */
  async list(eventBusId: string, ruleId: string) {
    try {
      const result: EventTargetListResponse = await this.request({
        Action: 'ListTargets' as const,
        EventBusId: eventBusId,
        RuleId: ruleId,
      });
      return result;
    } catch (error) {
      throw new ApiError({
        type: 'API_EB_ListEventTargets',
        message: `List event targets failed: ${error?.message}`,
      });
    }
  }

  /** 创建事件目标 */
  async create(targetConf: EventTargetCreateInputs) {
    const { eventBusId, ruleId, targetDescription, type = 'scf' } = targetConf;

    const apiInputs = {
      Action: 'CreateTarget' as const,
      eventBusId,
      ruleId,
      targetDescription,
      type,
    };
    try {
      const res: { TargetId: string } = await this.request(apiInputs);

      const outputs: EventTargetOutputs = {
        targetId: res?.TargetId,
        ruleId,
        targetDescription,
        type,
      };
      console.log(`Create event target successfully`);
      return deepClone(outputs);
    } catch (error) {
      throw new ApiError({
        type: 'API_EB_CreateEventTarget',
        message: `Create event target failed: ${error?.message}`,
      });
    }
  }

  /** 删除事件目标 */
  async delete(eventBusId: string, ruleId: string, targetId: string) {
    try {
      console.log(`Start removing event rule target, id ${targetId}...`);
      await this.request({
        Action: 'DeleteTarget',
        EventBusId: eventBusId,
        RuleId: ruleId,
        TargetId: targetId,
      });
      console.log(`Remove event rule target, id ${targetId} successfully`);
    } catch (e) {
      throw new ApiError({
        type: 'API_EB_RemoveEventTarget',
        message: `Remove event target id:${targetId} failed: ${e?.message}`,
      });
    }
    return true;
  }
}
