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
  ApigwUpdateServiceInputs,
  ApigwDeployWithServiceIdInputs,
} from './interface';
import { getProtocolString } from './utils';

// sub service entities
import ServiceEntity from './entities/service';
import ApiEntity from './entities/api';
import UsagePlanEntity from './entities/usage-plan';
import CustomDomainEntity from './entities/custom-domain';

export default class Apigw {
  credentials: CapiCredentials;
  capi: Capi;
  trigger: ApigwTrigger;
  region: RegionType;
  service: ServiceEntity;
  api: ApiEntity;
  customDomain: CustomDomainEntity;
  usagePlan: UsagePlanEntity;

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

  /** 部署 API 网关 */
  async deploy(inputs: ApigwDeployInputs) {
    const { environment = 'release' as const, oldState = {}, isInputServiceId = false } = inputs;
    if (isInputServiceId) {
      return this.deployWIthInputServiceId(inputs as ApigwDeployWithServiceIdInputs);
    }
    inputs.protocols = getProtocolString(inputs.protocols as ('http' | 'https')[]);

    let serviceOutputs: ApigwCreateOrUpdateServiceOutputs;
    if (inputs.serviceId) {
      serviceOutputs = await this.service.update(inputs as ApigwUpdateServiceInputs);
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

    await this.service.release({ serviceId, environment });

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

    return outputs;
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
    } = inputs;

    // check service exist
    const detail = await this.request({
      Action: 'DescribeService',
      ServiceId: serviceId,
    });
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
    if (isRemoveTrigger) {
      await this.service.release({ serviceId, environment });
      return;
    }

    // remove usage plan
    if (usagePlan) {
      await this.usagePlan.remove({
        serviceId,
        environment,
        usagePlan,
      });
    }

    // 2. unbind all custom domains
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

    if (created === true) {
      // unrelease service
      console.log(`Unreleasing service: ${serviceId}, environment ${environment}`);
      await this.removeRequest({
        Action: 'UnReleaseService',
        serviceId,
        environmentName: environment,
      });
      console.log(`Unrelease service ${serviceId}, environment ${environment} success`);

      // delete service
      console.log(`Removing service ${serviceId}`);
      await this.removeRequest({
        Action: 'DeleteService',
        serviceId,
      });
      console.log(`Remove service ${serviceId} success`);
    }
  }

  async deployWIthInputServiceId(inputs: ApigwDeployWithServiceIdInputs) {
    const { environment = 'release' as const, oldState = {}, serviceId } = inputs;
    inputs.protocols = getProtocolString(inputs.protocols as ('http' | 'https')[]);

    const endpoints = inputs.endpoints || [];
    const stateApiList = oldState.apiList || [];

    const serviceDetail = await this.service.getById(serviceId);

    const apiList: ApiEndpoint[] = await this.api.bulkDeploy({
      apiList: endpoints,
      stateList: stateApiList,
      serviceId,
      environment,
    });

    await this.service.release({ serviceId, environment });

    console.log(`Deploy service ${serviceId} success`);

    const outputs: ApigwDeployOutputs = {
      created: false,
      serviceId,
      serviceName: serviceDetail.serviceName,
      subDomain: serviceDetail.subDomain,
      protocols: inputs.protocols,
      environment: environment,
      apiList,
    };

    return outputs;
  }
}

module.exports = Apigw;
