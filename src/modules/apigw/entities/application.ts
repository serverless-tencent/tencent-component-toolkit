import { ApiAppCreateOptions, ApiAppItem, ApiAppDetail } from './../interface';
import { Capi } from '@tencent-sdk/capi';
import APIS, { ActionType } from '../apis';
import { pascalCaseProps } from '../../../utils';

interface AppDetail {
  id?: string;
  name: string;
  description?: string;
}

interface AppBindOptions {
  serviceId: string;
  environment: string;
  apiId: string;
  appConfig: AppDetail;
}

export default class AppEntity {
  capi: Capi;
  constructor(capi: Capi) {
    this.capi = capi;
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, pascalCaseProps(data));
    return result as any;
  }

  async removeRequest({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    try {
      await APIS[Action](this.capi, pascalCaseProps(data));
    } catch (e) {
      console.warn(e);
    }
    return true;
  }

  async get(id: string): Promise<ApiAppDetail | undefined> {
    const { ApiAppSet = [] }: { ApiAppSet: ApiAppItem[] } = await this.request({
      Action: 'DescribeApiApp',
      ApiAppId: id,
    });
    if (ApiAppSet[0] && ApiAppSet[0].ApiAppId === id) {
      const [current] = ApiAppSet;
      return {
        id,
        name: current.ApiAppName,
        description: current.ApiAppDesc,
        key: current.ApiAppKey,
        secret: current.ApiAppSecret,
      };
    }
    return undefined;
  }

  // bind api to application, if not config app id just create it
  async bind({ serviceId, environment, apiId, appConfig }: AppBindOptions) {
    // 1. create app
    let appDetail: AppDetail;
    if (appConfig.id) {
      // update
      appDetail = await this.update({
        ...appConfig,
        id: appConfig.id,
      });
    } else {
      appDetail = await this.create(appConfig);
    }
    // 2. bind api to app
    console.log(`Binding api(${apiId}) to application(${appDetail.id})`);

    await this.request({
      Action: 'BindApiApp',
      ApiAppId: appDetail.id,
      ApiId: apiId,
      Environment: environment,
      ServiceId: serviceId,
    });

    return appDetail;
  }

  async unbind({ serviceId, environment, apiId, appConfig }: AppBindOptions) {
    console.log(`Unbinding api(${apiId}) from application(${appConfig.id})`);

    const res = await this.request({
      Action: 'UnbindApiApp',
      ApiAppId: appConfig.id,
      ApiId: apiId,
      Environment: environment,
      ServiceId: serviceId,
    });

    return res;
  }

  async create({ name, description = '' }: ApiAppCreateOptions) {
    console.log(`Creating apigw application ${name}`);

    const res = await this.request({
      Action: 'CreateApiApp',
      ApiAppName: name,
      ApiAppDesc: description,
    });

    return {
      id: res.ApiAppId,
      name,
      description,
    };
  }

  async update({ id, name, description = '' }: ApiAppCreateOptions & { id: string }) {
    console.log(`Updating apigw application ${id}(${name})`);
    await this.request({
      Action: 'ModifyApiApp',
      ApiAppId: id,
      ApiAppName: name,
      ApiAppDesc: description,
    });

    return {
      id,
      name,
      description,
    };
  }
  async delete(id: string) {
    console.log(`Removing apigw application ${id}`);
    await this.removeRequest({
      Action: 'DeleteApiApp',
      ApiAppId: id,
    });

    return true;
  }
}
