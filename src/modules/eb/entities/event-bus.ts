import { Capi } from '@tencent-sdk/capi';
import APIS, { ActionType } from '../apis';
import { deepClone, pascalCaseProps } from '../../../utils';
import {
  EventBusBaseInfo,
  EventBusCreateOrUpdateOutputs,
  EventBusDetail,
  EventBusListResponse,
  EventBusUpdateInputs,
} from '../interface';
import { ApiError } from '../../../utils/error';

export default class EventBusEntity {
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

  /** 查询事件集详情 */
  async getById(eventBusId: string) {
    try {
      const detail: EventBusDetail = await this.request({
        Action: 'GetEventBus',
        EventBusId: eventBusId,
      });
      return detail;
    } catch (e) {
      throw new ApiError({
        type: 'API_EB_GetEventById',
        message: `Get event id:${eventBusId} failed: ${e?.message}`,
      });
    }
  }

  /** 查询事件集列表 */
  async list() {
    try {
      const result: EventBusListResponse = await this.request({ Action: 'ListEventBuses' });
      return result?.TotalCount || 0;
    } catch (error) {
      throw new ApiError({
        type: 'API_EB_ListEventBus',
        message: `List event bus failed: ${error?.message}`,
      });
    }
  }

  /** 创建事件集 */
  async create(
    eventConf: EventBusBaseInfo,
    accountLimit: number,
  ): Promise<EventBusCreateOrUpdateOutputs> {
    const { eventBusName, type = 'Cloud', description = 'Created By Serverless' } = eventConf;

    const existEventCount = await this.list();
    if (existEventCount >= accountLimit) {
      console.log(`The total of event buses can't exceed the account limit: ${accountLimit}.`);
    }

    try {
      const apiInputs = { Action: 'CreateEventBus' as const, eventBusName, type, description };
      const res: { EventBusId: string } = await this.request(apiInputs);
      const outputs: EventBusCreateOrUpdateOutputs = {
        eventBusId: res?.EventBusId,
        eventBusName,
        type,
        description,
      };
      console.log(`Create event bus ${eventBusName} successfully`);
      return deepClone(outputs);
    } catch (error) {
      throw new ApiError({
        type: 'API_EB_CreateEventBus',
        message: `Create event failed: ${error?.message}`,
      });
    }
  }

  /** 更新事件集 */
  async update(eventConf: EventBusUpdateInputs, accountLimit: number) {
    const { eventBusId, eventBusName, description = 'Created By Serverless' } = eventConf;

    let exist = false;
    let detail: EventBusDetail | null;
    let outputs: EventBusCreateOrUpdateOutputs = { eventBusId };

    try {
      if (eventBusId) {
        detail = await this.getById(eventBusId);
        if (detail) {
          exist = true;
          outputs.type = detail?.Type;
          outputs.eventBusName = eventBusName || detail?.EventBusName;
          outputs.description = description || detail?.Description;

          // 如果 eventBusName,description 任意字段更新了，则更新事件集
          if (!(eventBusName === detail?.EventBusName && description === detail?.Description)) {
            const apiInputs = {
              Action: 'UpdateEventBus' as const,
              eventBusId,
              eventBusName,
              description,
            };
            await this.request(apiInputs);
            console.log(`Update event ${eventBusName} successfully`);
          }
        }
      }
    } catch (error) {
      throw new ApiError({
        type: 'API_EB_UpdateEventBus',
        message: `Create event failed: ${error?.message}`,
      });
    }

    if (!exist) {
      // 进入创建流程
      const createRes = await this.create(eventConf, accountLimit);
      outputs = createRes as EventBusCreateOrUpdateOutputs;
    }
    return deepClone(outputs);
  }

  /** 删除事件集 */
  async delete(eventBusId: string) {
    try {
      console.log(`Start removing event, id ${eventBusId}...`);
      if (eventBusId) {
        await this.request({ Action: 'DeleteEventBus' as const, eventBusId });
        console.log(`Remove event, id ${eventBusId} successfully`);
      }
    } catch (e) {
      throw new ApiError({
        type: 'API_EB_RemoveEventBus',
        message: `Remove event failed: ${e?.message}`,
      });
    }
    return true;
  }
}
