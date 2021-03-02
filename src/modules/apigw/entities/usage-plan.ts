import { Capi } from '@tencent-sdk/capi';
import APIS, { ActionType } from '../apis';
import {
  Secret,
  ApigwSetupUsagePlanInputs,
  ApigwBindUsagePlanOutputs,
  ApigwSetupUsagePlanSecretInputs,
  ApigwRemoveUsagePlanInputs,
} from '../interface';
import { pascalCaseProps, uniqueArray } from '../../../utils';

export default class UsagePlanEntiry {
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

  /** 设置 API 网关密钥 */
  async setupSecret({ secretName, secretIds, created }: ApigwSetupUsagePlanSecretInputs) {
    const secretIdsOutput = {
      created: !!created,
      secretIds,
    };

    // user not setup secret ids, just auto generate one
    if (!secretIds || secretIds.length === 0) {
      console.log(`Creating a new Secret key.`);
      const { AccessKeyId, AccessKeySecret } = await this.request({
        Action: 'CreateApiKey',
        SecretName: secretName,
        AccessKeyType: 'auto',
      });
      console.log(`Secret id ${AccessKeyId} and key ${AccessKeySecret} created`);
      secretIdsOutput.secretIds = [AccessKeyId];
      secretIdsOutput.created = true;
    } else {
      // use setup secret ids
      // 1. unique it
      // 2. make sure all bind secret ids exist in user's list
      const uniqSecretIds = uniqueArray(secretIds);

      // get all secretId, check local secretId exists
      const { ApiKeySet } = (await this.request({
        Action: 'DescribeApiKeysStatus',
        Limit: uniqSecretIds.length,
        Filters: [
          {
            Name: 'AccessKeyId',
            Values: uniqSecretIds,
          },
        ],
      })) as {
        ApiKeySet: { AccessKeyId: string; Status: string }[];
      };

      const existKeysLen = ApiKeySet.length;

      // Filter invalid and non-existent keys
      const ids: string[] = [];
      uniqSecretIds.forEach((secretId: string) => {
        let found = false;
        let disable = false;
        for (let n = 0; n < existKeysLen; n++) {
          if (ApiKeySet[n] && secretId === ApiKeySet[n].AccessKeyId) {
            if (Number(ApiKeySet[n].Status) === 1) {
              found = true;
            } else {
              disable = true;
              console.log(`There is a disabled secret id ${secretId}, cannot be bound`);
            }
            break;
          }
        }
        if (!found) {
          if (!disable) {
            console.log(`Secret id ${secretId} doesn't exist`);
          }
        } else {
          ids.push(secretId);
        }
      });
      secretIdsOutput.secretIds = ids;
    }

    return secretIdsOutput;
  }

  /** 设置 API 网关的使用计划 */
  async setup({
    usagePlan,
  }: {
    usagePlan: ApigwSetupUsagePlanInputs;
  }): Promise<ApigwSetupUsagePlanInputs> {
    const usageInputs = {
      usagePlanName: usagePlan.usagePlanName ?? '',
      usagePlanDesc: usagePlan.usagePlanDesc ?? '',
      maxRequestNumPreSec: usagePlan.maxRequestNumPreSec ?? -1,
      maxRequestNum: usagePlan.maxRequestNum ?? -1,
    };

    const usagePlanOutput = {
      created: usagePlan.created || false,
      usagePlanId: usagePlan.usagePlanId,
    };

    let exist = false;
    if (usagePlan.usagePlanId) {
      try {
        const detail = (await this.request({
          Action: 'DescribeUsagePlan',
          UsagePlanId: usagePlan.usagePlanId,
        })) as {
          UsagePlanId: string;
        };
        if (detail && detail.UsagePlanId) {
          exist = true;
        }
      } catch (e) {
        // no op
      }
    }

    if (exist) {
      console.log(`Updating usage plan ${usagePlan.usagePlanId}`);
      await this.request({
        Action: 'ModifyUsagePlan',
        usagePlanId: usagePlanOutput.usagePlanId,
        ...usageInputs,
      });
    } else {
      const { UsagePlanId } = await this.request({
        Action: 'CreateUsagePlan',
        ...usageInputs,
      });

      usagePlanOutput.usagePlanId = UsagePlanId;
      usagePlanOutput.created = true;
      console.log(`Usage plan ${usagePlanOutput.usagePlanId} created`);
    }

    return usagePlanOutput;
  }

  /** 获取 secrets 列表 */
  async getBindedSecrets(
    usagePlanId: string,
    res: Secret[] = [],
    { limit, offset = 0 }: { limit: number; offset?: number },
  ): Promise<Secret[]> {
    const { AccessKeyList } = (await this.request({
      Action: 'DescribeUsagePlanSecretIds',
      usagePlanId,
      limit,
      offset,
    })) as {
      AccessKeyList: Secret[];
    };

    if (AccessKeyList.length < limit) {
      return AccessKeyList;
    }
    const more = await this.getBindedSecrets(usagePlanId, AccessKeyList, {
      limit,
      offset: offset + AccessKeyList.length,
    });
    // FIXME: more is same type with res, why concat?
    // return res.concat(more.AccessKeyList);
    return res.concat(more);
  }

  /**
   * 找到所有不存在的 secretIds
   */
  async getUnbindSecretIds({
    usagePlanId,
    secretIds,
  }: {
    usagePlanId: string;
    secretIds: string[];
  }) {
    const bindedSecretObjs = await this.getBindedSecrets(usagePlanId, [], { limit: 100 });
    const bindedSecretIds = bindedSecretObjs.map((item) => item.AccessKeyId);

    const unbindSecretIds = secretIds.filter((item) => {
      if (bindedSecretIds.indexOf(item) === -1) {
        return true;
      }
      console.log(`Usage plan ${usagePlanId} secret id ${item} already bound`);
      return false;
    });
    return unbindSecretIds;
  }

  async bind({
    apiId,
    serviceId,
    environment,
    usagePlanConfig,
    authConfig,
  }: ApigwBindUsagePlanOutputs) {
    const usagePlan = await this.setup({
      usagePlan: usagePlanConfig,
    });

    if (authConfig) {
      const { secretIds = [] } = authConfig;
      const secrets = await this.setupSecret({
        secretName: authConfig.secretName,
        secretIds,
      });

      const unbindSecretIds = await this.getUnbindSecretIds({
        usagePlanId: usagePlan.usagePlanId,
        secretIds: secrets.secretIds!,
      });

      if (unbindSecretIds.length > 0) {
        console.log(`Binding secret key ${unbindSecretIds} to usage plan ${usagePlan.usagePlanId}`);
        await this.request({
          Action: 'BindSecretIds',
          usagePlanId: usagePlan.usagePlanId,
          accessKeyIds: unbindSecretIds,
        });
        console.log('Binding secret key successed.');
      }
      // store in api list
      usagePlan.secrets = secrets;
    }

    const { ApiUsagePlanList } = (await this.request({
      Action: 'DescribeApiUsagePlan',
      serviceId,
      limit: 100,
    })) as { ApiUsagePlanList: { UsagePlanId: string; ApiId: string }[] };

    const oldUsagePlan = ApiUsagePlanList.find((item) => {
      return apiId
        ? item.UsagePlanId === usagePlan.usagePlanId && item.ApiId === apiId
        : item.UsagePlanId === usagePlan.usagePlanId;
    });

    if (oldUsagePlan) {
      if (apiId) {
        console.log(`Usage plan ${usagePlan.usagePlanId} already bind to api ${apiId}`);
      } else {
        console.log(
          `Usage plan ${usagePlan.usagePlanId} already bind to enviromment ${environment}`,
        );
      }

      return usagePlan;
    }

    if (apiId) {
      console.log(`Binding usage plan ${usagePlan.usagePlanId} to api ${apiId}`);
      await this.request({
        Action: 'BindEnvironment',
        serviceId,
        environment,
        bindType: 'API',
        usagePlanIds: [usagePlan.usagePlanId],
        apiIds: [apiId],
      });
      console.log(`Bind usage plan ${usagePlan.usagePlanId} to api ${apiId} success`);
      return usagePlan;
    }

    console.log(`Binding usage plan ${usagePlan.usagePlanId} to enviromment ${environment}`);
    await this.request({
      Action: 'BindEnvironment',
      serviceId,
      environment,
      bindType: 'SERVICE',
      usagePlanIds: [usagePlan.usagePlanId],
    });
    console.log(`Bind usage plan ${usagePlan.usagePlanId} to enviromment ${environment} success`);

    return usagePlan;
  }

  async removeSecretId(secretId: string) {
    console.log(`Removing secret key ${secretId}`);
    await this.removeRequest({
      Action: 'DisableApiKey',
      accessKeyId: secretId,
    });
    await this.removeRequest({
      Action: 'DeleteApiKey',
      accessKeyId: secretId,
    });
  }

  async remove({ serviceId, environment, usagePlan, apiId }: ApigwRemoveUsagePlanInputs) {
    // 1.1 unbind secrete ids
    const { secrets } = usagePlan;

    if (secrets && secrets.secretIds) {
      await this.removeRequest({
        Action: 'UnBindSecretIds' as const,
        accessKeyIds: secrets.secretIds,
        usagePlanId: usagePlan.usagePlanId,
      });
      console.log(`Unbinding secret key from usage plan ${usagePlan.usagePlanId}`);

      // delelet all created api key
      if (usagePlan.secrets?.created === true) {
        for (let sIdx = 0; sIdx < secrets.secretIds.length; sIdx++) {
          const secretId = secrets.secretIds[sIdx];
          await this.removeSecretId(secretId);
        }
      }
    }

    // 1.2 unbind environment
    if (apiId) {
      await this.removeRequest({
        Action: 'UnBindEnvironment',
        serviceId,
        usagePlanIds: [usagePlan.usagePlanId],
        environment,
        bindType: 'API',
        apiIds: [apiId],
      });
    } else {
      await this.removeRequest({
        Action: 'UnBindEnvironment',
        serviceId,
        usagePlanIds: [usagePlan.usagePlanId],
        environment,
        bindType: 'SERVICE',
      });
    }

    console.log(`Unbinding usage plan ${usagePlan.usagePlanId} from service ${serviceId}`);

    // 1.3 delete created usage plan
    if (usagePlan.created === true) {
      console.log(`Removing usage plan ${usagePlan.usagePlanId}`);
      await this.removeRequest({
        Action: 'DeleteUsagePlan',
        usagePlanId: usagePlan.usagePlanId,
      });
    }
  }
}
