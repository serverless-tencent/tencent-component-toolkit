import { TagInput } from './../../interface';
import { Capi } from '@tencent-sdk/capi';
import {
  ApigwCreateServiceInputs,
  ApigwUpdateServiceInputs,
  ApigwCreateOrUpdateServiceOutputs,
  ApigwSetupUsagePlanInputs,
} from '../interface';
import { ApiServiceType } from '../../interface';
import { pascalCaseProps, deepClone } from '../../../utils';
import APIS, { ActionType } from '../apis';
import UsagePlanEntity from './usage-plan';
import Tag from '../../tag';

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
  tag: Tag;

  constructor(capi: Capi) {
    this.capi = capi;

    this.usagePlan = new UsagePlanEntity(capi);

    const { options } = capi;
    this.tag = new Tag(
      {
        SecretId: options.SecretId,
        SecretKey: options.SecretKey,
        Token: options.Token,
      },
      options.Region,
    );
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, pascalCaseProps(data));
    return result as never;
  }

  /**
   * 获取 API 网关列表
   * @param options 参数
   * @returns 网关列表
   */
  async list(options?: { offset?: number; limit?: number }) {
    options = {
      ...{ limit: 10, offset: 0 },
      ...(options || {}),
    };
    try {
      const res: { TotalCount: number; ServiceSet: any[] } = await this.request({
        Action: 'DescribeServicesStatus',
        Offset: options.offset,
        Limit: options.limit,
      });
      return res.ServiceSet || [];
    } catch (e) {
      return [];
    }
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

  async removeApiUsagePlan(ServiceId: string) {
    const { ApiUsagePlanList = [] } = await this.request({
      Action: 'DescribeApiUsagePlan',
      ServiceId,
    });

    for (let i = 0; i < ApiUsagePlanList.length; i++) {
      const { UsagePlanId, Environment, ApiId } = ApiUsagePlanList[i];
      console.log(`APIGW - Removing api usage plan: ${UsagePlanId}`);
      const { AccessKeyList = [] } = await this.request({
        Action: 'DescribeUsagePlanSecretIds',
        UsagePlanId: UsagePlanId,
        Limit: 100,
      });

      const AccessKeyIds = AccessKeyList.map((item: { SecretId: string }) => item.SecretId);

      if (AccessKeyIds && AccessKeyIds.length > 0) {
        await this.request({
          Action: 'UnBindSecretIds',
          UsagePlanId: UsagePlanId,
          AccessKeyIds: AccessKeyIds,
        });
        // delelet all created api key
        for (let sIdx = 0; sIdx < AccessKeyIds.length; sIdx++) {
          await this.request({
            Action: 'DisableApiKey',
            AccessKeyId: AccessKeyIds[sIdx],
          });
        }
      }

      // unbind environment
      await this.request({
        Action: 'UnBindEnvironment',
        ServiceId,
        UsagePlanIds: [UsagePlanId],
        Environment: Environment,
        BindType: 'API',
        ApiIds: [ApiId],
      });

      await this.request({
        Action: 'DeleteUsagePlan',
        UsagePlanId: UsagePlanId,
      });
    }
  }

  async removeById(serviceId: string) {
    try {
      const { ApiIdStatusSet = [] } = await this.request({
        Action: 'DescribeApisStatus',
        ServiceId: serviceId,
        Limit: 100,
      });

      // remove all apis
      for (let i = 0; i < ApiIdStatusSet.length; i++) {
        const { ApiId } = ApiIdStatusSet[i];

        await this.removeApiUsagePlan(serviceId);

        console.log(`APIGW - Removing api: ${ApiId}`);

        await this.request({
          Action: 'DeleteApi',
          ServiceId: serviceId,
          ApiId,
        });
      }

      // unrelease service
      // get environment list
      const { EnvironmentList = [] } = await this.request({
        Action: 'DescribeServiceEnvironmentList',
        ServiceId: serviceId,
      });

      for (let i = 0; i < EnvironmentList.length; i++) {
        const { EnvironmentName, Status } = EnvironmentList[i];
        if (Status === 1) {
          try {
            console.log(
              `APIGW - Unreleasing service: ${serviceId}, environment: ${EnvironmentName}`,
            );
            await this.request({
              Action: 'UnReleaseService',
              ServiceId: serviceId,
              EnvironmentName,
            });
          } catch (e) {}
        }
      }

      // delete service
      console.log(`APIGW - Removing service: ${serviceId}`);
      await this.request({
        Action: 'DeleteService',
        ServiceId: serviceId,
      });
    } catch (e) {
      console.error(e);
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

  async remove({ serviceId, environment }: { serviceId: string; environment: string }) {
    const detail = await this.getById(serviceId);
    if (!detail) {
      console.log(`API service ${serviceId} not exist`);
      return true;
    }

    try {
      console.log(`Unreleasing service: ${serviceId}, environment ${environment}`);
      await this.request({
        Action: 'UnReleaseService',
        serviceId,
        environmentName: environment,
      });
      console.log(`Unrelease service ${serviceId}, environment ${environment} success`);

      // 在删除之前，如果关联了标签，需要先删除标签关联
      if (detail.Tags && detail.Tags.length > 0) {
        await this.tag.deployResourceTags({
          tags: [],
          resourceId: serviceId,
          serviceType: ApiServiceType.apigw,
          resourcePrefix: 'service',
        });
      }

      // delete service
      console.log(`Removing service ${serviceId}`);
      await this.request({
        Action: 'DeleteService',
        serviceId,
      });
      console.log(`Remove service ${serviceId} success`);
    } catch (e) {
      console.log(e.message);
    }
  }
}
