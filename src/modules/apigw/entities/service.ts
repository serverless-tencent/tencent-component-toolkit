import { TagInput } from './../../interface';
import { Capi } from '@tencent-sdk/capi';
import {
  ApigwCreateServiceInputs,
  ApigwUpdateServiceInputs,
  ApigwCreateOrUpdateServiceOutputs,
  ApigwSetupUsagePlanInputs,
} from '../interface';
import { pascalCaseProps, deepClone } from '../../../utils';
import APIS, { ActionType } from '../apis';
import UsagePlanEntity from './usage-plan';

interface Detail {
  InnerSubDomain: string;
  InternalSubDomain: string;
  OuterSubDomain: string;

  ServiceId: string;

  // FIXME: 小写？
  ServiceName: string;
  ServiceDesc: string;
  Protocol: string;
  Tags: TagInput[];
}

export default class ServiceEntity {
  capi: Capi;
  usagePlan: UsagePlanEntity;

  constructor(capi: Capi) {
    this.capi = capi;

    this.usagePlan = new UsagePlanEntity(capi);
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, pascalCaseProps(data));
    return result as never;
  }

  async getById(serviceId: string) {
    try {
      const detail: Detail = await this.request({
        Action: 'DescribeService',
        ServiceId: serviceId,
      });

      return detail;
    } catch (e) {
      return null;
    }
  }

  /** 创建 API 网关服务 */
  async create(serviceConf: ApigwCreateServiceInputs): Promise<ApigwCreateOrUpdateServiceOutputs> {
    const {
      environment,
      protocols,
      netTypes,
      serviceName = 'serverless',
      serviceDesc = 'Created By Serverless',
    } = serviceConf;

    const apiInputs = {
      Action: 'CreateService' as const,
      serviceName: serviceName,
      serviceDesc: serviceDesc,
      protocol: protocols,
      netTypes,
    };

    const detail: Detail = await this.request(apiInputs);

    const outputs = {
      serviceName,
      serviceId: detail!.ServiceId,
      subDomain:
        detail!.OuterSubDomain && detail!.InnerSubDomain
          ? [detail!.OuterSubDomain, detail!.InnerSubDomain]
          : detail!.OuterSubDomain || detail!.InnerSubDomain,
      serviceCreated: true,
      usagePlan: undefined as undefined | ApigwSetupUsagePlanInputs,
    };

    if (serviceConf.usagePlan) {
      outputs.usagePlan = await this.usagePlan.bind({
        serviceId: detail!.ServiceId,
        environment,
        usagePlanConfig: serviceConf.usagePlan,
        authConfig: serviceConf.auth,
      });
    }

    return deepClone(outputs);
  }

  /** 更新 API 网关服务 */
  async update(serviceConf: ApigwUpdateServiceInputs): Promise<ApigwCreateOrUpdateServiceOutputs> {
    const {
      environment,
      serviceId,
      protocols,
      netTypes,
      serviceName = 'serverless',
      serviceDesc = 'Created By Serverless',
    } = serviceConf;

    let detail: Detail | null;

    let outputs: ApigwCreateOrUpdateServiceOutputs = {
      serviceId: serviceId,
      serviceCreated: false,
      serviceName,
      usagePlan: undefined as undefined | ApigwSetupUsagePlanInputs,
      subDomain: '',
    };

    let exist = false;

    if (serviceId) {
      detail = await this.getById(serviceId);
      if (detail) {
        detail.InnerSubDomain = detail.InternalSubDomain;
        exist = true;
        outputs.serviceId = detail!.ServiceId;
        outputs.subDomain =
          detail!.OuterSubDomain && detail!.InnerSubDomain
            ? [detail!.OuterSubDomain, detail!.InnerSubDomain]
            : detail!.OuterSubDomain || detail!.InnerSubDomain;

        if (serviceConf.usagePlan) {
          outputs.usagePlan = await this.usagePlan.bind({
            serviceId: detail!.ServiceId,
            environment,
            usagePlanConfig: serviceConf.usagePlan,
            authConfig: serviceConf.auth,
          });
        }
        // 如果 serviceName，serviceDesc，protocols任意字段更新了，则更新服务
        if (
          !(
            serviceName === detail.ServiceName &&
            serviceDesc === detail.ServiceDesc &&
            protocols === detail.Protocol
          )
        ) {
          const apiInputs = {
            Action: 'ModifyService' as const,
            serviceId,
            serviceDesc: serviceDesc || detail.ServiceDesc,
            serviceName: serviceName || detail.ServiceName,
            protocol: protocols,
            netTypes: netTypes,
          };
          await this.request(apiInputs);
        }
      }
    }

    if (!exist) {
      // 进入创建流程
      outputs = await this.create(serviceConf);
    }

    return deepClone(outputs);
  }

  async release({ serviceId, environment }: { serviceId: string; environment: string }) {
    console.log(`Releaseing service ${serviceId}, environment ${environment}`);
    await this.request({
      Action: 'ReleaseService',
      serviceId: serviceId,
      environmentName: environment,
      releaseDesc: 'Released by Serverless',
    });
  }
}
