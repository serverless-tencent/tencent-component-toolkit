import { RegionType } from '../interface';
import { Capi } from '@tencent-sdk/capi';
import { ApigwTrigger } from '../triggers';
import { pascalCaseProps, isArray } from '../../utils';
import { CapiCredentials, ApiServiceType } from '../interface';
import APIS, { ActionType } from './apis';
import {
  ApigwDeployInputs,
  ApiEndpoint,
  ApigwDeployOutputs,
  ApigwRemoveInputs,
  ApigwCreateOrUpdateServiceOutputs,
  ApigwDeployWithServiceIdInputs,
} from './interface';
import { getProtocolString, getUrlProtocol } from './utils';

// sub service entities
import ServiceEntity from './entities/service';
import ApiEntity from './entities/api';
import UsagePlanEntity from './entities/usage-plan';
import CustomDomainEntity from './entities/custom-domain';
import { ApiError } from '../../utils/error';
import TagClient from '../tag';

export default class Apigw {
  credentials: CapiCredentials;
  capi: Capi;
  trigger: ApigwTrigger;
  region: RegionType;
  service: ServiceEntity;
  api: ApiEntity;
  customDomain: CustomDomainEntity;
  usagePlan: UsagePlanEntity;
  tagClient: TagClient;

  constructor(credentials: CapiCredentials, region: RegionType = 'ap-guangzhou') {
    this.credentials = credentials;
    this.region = region;
    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.apigateway,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });
    this.trigger = new ApigwTrigger({ credentials, region: this.region });

    this.service = new ServiceEntity(this.capi);
    this.api = new ApiEntity(this.capi, this.trigger);
    this.usagePlan = new UsagePlanEntity(this.capi);
    this.customDomain = new CustomDomainEntity(this.capi);

    this.tagClient = new TagClient(this.credentials, this.region);
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

  formatApigwOutputs(outputs: ApigwDeployOutputs): ApigwDeployOutputs {
    const baseUrl = `${getUrlProtocol(outputs.protocols as string)}://${outputs.subDomain}`;
    outputs.url = baseUrl;

    outputs.apiList = outputs.apiList.map((item: ApiEndpoint) => {
      item.url = `${baseUrl}/${outputs.environment}${`/${item.path}`.replace('//', '/')}`;
      return item;
    });

    return outputs;
  }

  /** 部署 API 网关 */
  async deploy(inputs: ApigwDeployInputs) {
    const {
      environment = 'release' as const,
      oldState = {},
      isInputServiceId = false,
      isAutoRelease = true,
    } = inputs;
    if (isInputServiceId) {
      return this.deployWIthInputServiceId(inputs as ApigwDeployWithServiceIdInputs);
    }
    inputs.protocols = getProtocolString(inputs.protocols as ('http' | 'https')[]);

    let serviceOutputs: ApigwCreateOrUpdateServiceOutputs;
    if (inputs.serviceId) {
      serviceOutputs = await this.service.update({ ...inputs, serviceId: inputs.serviceId! });
    } else {
      serviceOutputs = await this.service.create(inputs);
    }

    const { serviceId, serviceName, subDomain, serviceCreated, usagePlan } = serviceOutputs;

    const endpoints = inputs.endpoints || [];
    const stateApiList = oldState.apiList || [];

    const apiList: ApiEndpoint[] = await this.api.bulkDeploy({
      apiList: endpoints,
      stateList: stateApiList,
      serviceId,
      environment,
    });

    if (isAutoRelease) {
      await this.service.release({ serviceId, environment });
    }

    console.log(`Deploy service ${serviceId} success`);

    const outputs: ApigwDeployOutputs = {
      created: serviceCreated ? true : oldState.created,
      serviceId,
      serviceName,
      subDomain,
      protocols: inputs.protocols,
      environment: environment,
      apiList,
    };

    // InstanceId 只能在创建时指定，创建后不可修改
    // 创建时不指定则是共享实例
    if (inputs.instanceId) {
      outputs.instanceId = inputs.instanceId;
    }

    // bind custom domain
    const customDomains = await this.customDomain.bind({
      serviceId,
      subDomain: isArray(subDomain) ? subDomain[0] : subDomain,
      inputs,
    });
    if (customDomains.length > 0) {
      outputs.customDomains = customDomains;
    }

    if (usagePlan) {
      outputs.usagePlan = usagePlan;
    }

    try {
      const { tags = [] } = inputs;
      await this.tagClient.deployResourceTags({
        tags: tags.map(({ key, value }) => ({ TagKey: key, TagValue: value })),
        resourceId: serviceId,
        serviceType: ApiServiceType.apigw,
        resourcePrefix: 'service',
      });
      if (tags.length > 0) {
        outputs.tags = tags;
      }
    } catch (e) {
      console.log(`[TAG] ${e.message}`);
    }

    return this.formatApigwOutputs(outputs);
  }

  async remove(inputs: ApigwRemoveInputs) {
    const {
      created,
      environment,
      serviceId,
      apiList,
      customDomains,
      usagePlan,
      isRemoveTrigger = false,
      isAutoRelease = true,
    } = inputs;

    // check service exist
    const detail = await this.service.getById(serviceId);
    if (!detail) {
      console.log(`Service ${serviceId} not exist`);
      return;
    }

    // 1. remove all apis
    await this.api.bulkRemove({
      apiList,
      serviceId,
      environment,
    });
    // 定制化需求：如果用户在yaml中配置了 serviceId，则只执行删除 api 逻辑
    // 删除后需要重新发布
    if (isRemoveTrigger && isAutoRelease) {
      await this.service.release({ serviceId, environment });
      return;
    }

    // 删除使用计划
    if (usagePlan) {
      await this.usagePlan.remove({
        serviceId,
        environment,
        usagePlan,
      });
    }

    // 解绑自定义域名
    if (customDomains) {
      for (let i = 0; i < customDomains.length; i++) {
        const curDomain = customDomains[i];
        if (curDomain.subDomain && curDomain.created === true) {
          console.log(`Unbinding custom domain ${curDomain.subDomain}`);
          await this.removeRequest({
            Action: 'UnBindSubDomain',
            serviceId,
            subDomain: curDomain.subDomain,
          });
        }
      }
    }

    if (created && isAutoRelease) {
      await this.service.remove({
        serviceId,
        environment,
      });
    }
  }

  async deployWIthInputServiceId(inputs: ApigwDeployWithServiceIdInputs) {
    const {
      environment = 'release' as const,
      oldState = {},
      serviceId,
      isAutoRelease = true,
    } = inputs;
    inputs.protocols = getProtocolString(inputs.protocols as ('http' | 'https')[]);

    const endpoints = inputs.endpoints || [];
    const stateApiList = oldState.apiList || [];

    const detail = await this.service.getById(serviceId);
    if (detail) {
      const apiList: ApiEndpoint[] = await this.api.bulkDeploy({
        apiList: endpoints,
        stateList: stateApiList,
        serviceId,
        environment,
      });

      if (isAutoRelease) {
        await this.service.release({ serviceId, environment });
      }

      console.log(`Deploy service ${serviceId} success`);

      const subDomain =
        detail!.OuterSubDomain && detail!.InnerSubDomain
          ? [detail!.OuterSubDomain, detail!.InnerSubDomain]
          : detail!.OuterSubDomain || detail!.InnerSubDomain;

      const outputs: ApigwDeployOutputs = {
        created: false,
        serviceId,
        serviceName: detail.ServiceName,
        subDomain: subDomain,
        protocols: inputs.protocols,
        environment: environment,
        apiList,
      };

      const { tags = [] } = inputs;
      if (tags.length > 0) {
        const deployedTags = await this.tagClient.deployResourceTags({
          tags: tags.map(({ key, value }) => ({ TagKey: key, TagValue: value })),
          resourceId: serviceId,
          serviceType: ApiServiceType.apigw,
          resourcePrefix: 'service',
        });

        outputs.tags = deployedTags.map((item) => ({
          key: item.TagKey,
          value: item.TagValue!,
        }));
      }

      return this.formatApigwOutputs(outputs);
    }
    throw new ApiError({
      type: 'API_APIGW_DescribeService',
      message: `Service ${serviceId} not exist`,
    });
  }
}

module.exports = Apigw;
