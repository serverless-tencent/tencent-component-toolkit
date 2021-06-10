import { Capi } from '@tencent-sdk/capi';
import APIS, { ActionType } from '../apis';
import { deepClone, getQcsResourceId, pascalCaseProps } from '../../../utils';
import {
  EventConnectionCreateInputs,
  EventConnectionDescription,
  EventConnectionDetail,
  EventConnectionListResponse,
  EventConnectionOutputs,
  EventConnectionUpdateInfo,
} from '../interface';
import { ApiError } from '../../../utils/error';
import ServiceEntity from '../../apigw/entities/service';
import { ApigwCreateOrUpdateServiceOutputs } from '../../apigw/interface';
import { RegionType } from '../../interface';

export default class ConnectionEntity {
  capi: Capi;
  region: RegionType;
  constructor(capi: Capi, region: RegionType) {
    this.capi = capi;
    this.region = region;
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

  /** 查询事件连接器详情， PS: 接口还未上线 */
  // async getById(eventBusId: string, connectionId: string) {
  //   try {
  //     const detail: EventConnectionDetail = await this.request({
  //       Action: 'GetConnection',
  //       EventBusId: eventBusId,
  //       ConnectionId: connectionId,
  //     });
  //     return detail;
  //   } catch (e) {
  //     throw new ApiError({
  //       type: 'API_EB_GetEventConnectionById',
  //       message: `Get event connection id:${connectionId} failed: ${e?.message}`,
  //     });
  //   }
  // }

  // TODO: GetConnection 接口上线后替换
  async getById(eventBusId: string, connectionId: string) {
    const existConnList = await this.list(eventBusId);
    if (existConnList?.TotalCount > 0) {
      const existConn = existConnList.Connections.find(
        (item: EventConnectionDetail) => item.ConnectionId === connectionId,
      );
      return existConn || null;
    }
    return null;
  }

  /** 查询事件连接器列表 */
  async list(eventBusId: string) {
    try {
      const result: EventConnectionListResponse = await this.request({
        Action: 'ListConnections' as const,
        EventBusId: eventBusId,
      });
      return result;
    } catch (error) {
      throw new ApiError({
        type: 'API_EB_ListEventConnections',
        message: `List event connections failed: ${error?.message}`,
      });
    }
  }

  /** 创建事件连接器 */
  async create(connConf: EventConnectionCreateInputs) {
    const {
      uin,
      eventBusId,
      connectionName,
      connectionDescription,
      type = 'apigw',
      description = 'Created By Serverless',
    } = connConf;

    // 没有指定连接器时，默认创建API网关服务进行绑定
    let tempConnDesc;
    if (
      uin &&
      (!connectionDescription ||
        !(connectionDescription?.resourceDescription && connectionDescription?.gwParams))
    ) {
      const service = new ServiceEntity(this.capi);
      const serviceRes: ApigwCreateOrUpdateServiceOutputs = await service.create({
        environment: 'release',
        protocols: 'http&https',
      });
      // e.g: `qcs::apigw:${this.region}:uin/${uin}:serviceid/${serviceRes.serviceId}`;
      const resourceId = getQcsResourceId(
        'apigw',
        this.region,
        uin,
        `serviceid/${serviceRes.serviceId}`,
      );
      tempConnDesc = {
        ResourceDescription: resourceId,
        APIGWParams: {
          Protocol: 'HTTP',
          Method: 'POST',
        },
      };
    }

    const apiInputs = {
      Action: 'CreateConnection' as const,
      enable: true,
      eventBusId,
      connectionName,
      type,
      description,
      connectionDescription: tempConnDesc || {
        ResourceDescription: connectionDescription?.resourceDescription,
        APIGWParams: connectionDescription?.gwParams,
      },
    };

    try {
      const res: { ConnectionId: string } = await this.request(apiInputs);
      const outputs: EventConnectionOutputs = {
        connectionId: res?.ConnectionId,
        connectionName,
        type,
        connectionDescription: apiInputs.connectionDescription as EventConnectionDescription,
      };
      console.log(`Create event connection ${connectionName} successfully`);
      return deepClone(outputs);
    } catch (error) {
      throw new ApiError({
        type: 'API_EB_CreateEventConnection',
        message: `Create event connection failed: ${error?.message}`,
      });
    }
  }

  /** 更新事件连接器 */
  async update(connConf: EventConnectionUpdateInfo) {
    const { eventBusId, connectionId, connectionName, description } = connConf;

    let detail: EventConnectionDetail | null;
    const outputs: EventConnectionOutputs = { connectionId };

    try {
      if (eventBusId && connectionId) {
        detail = await this.getById(eventBusId, connectionId);
        if (detail) {
          outputs.type = detail.Type;
          outputs.connectionName = detail.ConnectionName;
          outputs.connectionId = detail.ConnectionId;
          outputs.connectionDescription = detail.ConnectionDescription;
          const apiInputs = {
            Action: 'UpdateConnection' as const,
            connectionId,
            eventBusId,
            connectionName,
            description,
          };
          await this.request(apiInputs);
          console.log(`Update event connection ${connectionName} successfully`);
        }
      }

      return deepClone(outputs);
    } catch (error) {
      throw new ApiError({
        type: 'API_EB_UpdateEventConnection',
        message: `Update event connection failed: ${error?.message}`,
      });
    }
  }

  /** 删除事件连接器 */
  async delete(eventBusId: string, connectionId: string) {
    try {
      console.log(`Start removing event connection, id ${connectionId}...`);
      await this.request({
        Action: 'DeleteConnection',
        EventBusId: eventBusId,
        ConnectionId: connectionId,
      });
      console.log(`Remove event connection, id ${connectionId} successfully`);
    } catch (e) {
      console.log(JSON.stringify(e));
      throw new ApiError({
        type: 'API_EB_RemoveEventConnection',
        message: `Remove event connection failed: ${e?.message}`,
      });
    }

    return true;
  }
}
