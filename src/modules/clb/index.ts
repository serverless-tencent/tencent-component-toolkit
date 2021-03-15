import { Capi } from '@tencent-sdk/capi';
import { waitResponse } from '@ygkit/request';
import { ApiError } from './../../utils/error';
import { ApiServiceType } from '../interface';
import {
  ClbRule,
  ClbListener,
  CreateRuleInput,
  CreateRuleOutput,
  BindClbTriggerInput,
  DeleteRuleInput,
} from './interface';
import APIS, { ActionType } from './apis';
import { pascalCaseProps } from '../../utils/index';
import { CapiCredentials, RegionType } from '../interface';

export default class Clb {
  listeners: ClbListener[] | null;
  credentials: CapiCredentials;
  capi: Capi;
  region: RegionType;

  constructor(credentials: CapiCredentials, region: RegionType = 'ap-guangzhou') {
    this.credentials = credentials;
    this.region = region;

    this.capi = new Capi({
      Region: region,
      ServiceType: ApiServiceType.clb,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });

    this.listeners = null;
  }

  async getTaskStatus(taskId: string) {
    const res = await this.request({
      Action: 'DescribeTaskStatus',
      TaskId: taskId,
    });
    return res;
  }

  async loopForStatusReady(taskId: string) {
    await waitResponse({
      callback: async () => this.getTaskStatus(taskId),
      targetResponse: 0,
      targetProp: 'Status',
      loopGap: 100,
      timeout: 2 * 60 * 1000,
    });
  }

  async getListenerList(loadBalanceId: string) {
    if (this.listeners) {
      return this.listeners;
    }
    const { Listeners = [] } = await this.request({
      Action: 'DescribeListeners',
      LoadBalancerId: loadBalanceId,
    });
    // 缓存监听器列表
    this.listeners = Listeners;
    return Listeners;
  }

  /**
   *
   * @param param0
   * @returns ClbListener | undefined
   */
  async getListener({
    loadBalanceId,
    protocol,
    port,
  }: {
    loadBalanceId: string;
    protocol: string;
    port: number;
  }): Promise<ClbListener | undefined> {
    const listeners = await this.getListenerList(loadBalanceId);
    let existListener: ClbListener | undefined = undefined;
    if (listeners && listeners.length > 0) {
      for (let i = 0; i < listeners.length; i++) {
        const curListener = listeners[i];
        if (curListener.Protocol === protocol && curListener.Port === port) {
          existListener = curListener;
          break;
        }
      }
    }
    return existListener;
  }

  getRuleFromListener({
    listener,
    domain,
    url,
  }: {
    listener: ClbListener;
    domain: string;
    url: string;
  }) {
    let existRule: ClbRule | undefined = undefined;

    if (listener && listener.Rules.length > 0) {
      for (let i = 0; i < listener.Rules.length; i++) {
        const curRule = listener.Rules[i];
        if (curRule.Url === url && curRule.Domain === domain) {
          existRule = curRule;
          break;
        }
      }
    }

    return existRule;
  }

  async getRule({
    loadBalanceId,
    protocol,
    port,
    domain,
    url,
  }: {
    loadBalanceId: string;
    protocol: string;
    port: number;
    domain: string;
    url: string;
  }): Promise<ClbRule | undefined> {
    const listener = await this.getListener({
      loadBalanceId,
      protocol,
      port,
    });
    if (listener) {
      const existRule = this.getRuleFromListener({
        listener,
        domain,
        url,
      });
      return existRule;
    }
    return undefined;
  }

  async createRule({ loadBalanceId, protocol, port, url, domain }: CreateRuleInput) {
    const listener = await this.getListener({
      loadBalanceId,
      protocol,
      port,
    });
    if (listener) {
      const output: CreateRuleOutput = {
        loadBalanceId,
        protocol,
        port,
        domain,
        url,
        listenerId: listener.ListenerId,
        locationId: '',
      };
      const existRule = this.getRuleFromListener({
        listener,
        domain,
        url,
      });
      if (!existRule) {
        console.log(`[CLB] Creating rule(domain: ${domain}, url: ${url}) for ${loadBalanceId}`);
        const {
          LocationIds: [locationId],
          RequestId,
        } = await this.request({
          Action: 'CreateRule',
          LoadBalancerId: loadBalanceId,
          ListenerId: listener.ListenerId,
          Rules: [{ Domain: domain, Url: url }],
        });

        // 等待规则异步创建成功
        await this.loopForStatusReady(RequestId);

        console.log(
          `[CLB] Create rule(domain: ${domain}, url: ${url}) for ${loadBalanceId} success`,
        );
        output.locationId = locationId;
      } else {
        console.log(
          `[CLB] Rule(domain: ${domain}, url: ${url}) for ${loadBalanceId} already exist`,
        );
        output.locationId = existRule.LocationId;
      }

      return output;
    }

    throw new ApiError({
      type: 'API_CLB_getListener',
      message: `CLB id ${loadBalanceId} not exist`,
    });
  }

  async deleteRule({ loadBalanceId, listenerId, locationId, domain, url }: DeleteRuleInput) {
    let delReq: {
      Action: ActionType;
      LoadBalancerId: string;
      ListenerId: string;
      LocationIds?: string[];
      Domain?: string;
      Url?: string;
    };
    let ruleDesc = '';
    if (!locationId) {
      ruleDesc = `domain: ${domain}, url: ${url}`;

      delReq = {
        Action: 'DeleteRule',
        LoadBalancerId: loadBalanceId,
        ListenerId: listenerId,
        Domain: domain,
        Url: url,
      };
    } else {
      ruleDesc = `locationId: ${locationId}`;

      delReq = {
        Action: 'DeleteRule',
        LoadBalancerId: loadBalanceId,
        ListenerId: listenerId,
        LocationIds: [locationId],
      };
    }

    try {
      console.log(`[CLB] Deleting rule(${ruleDesc}) for clb ${loadBalanceId}`);
      const { RequestId } = await this.request(delReq);

      // 等待规则异步创建成功
      await this.loopForStatusReady(RequestId);

      console.log(`[CLB] Delete rule(${ruleDesc}) for clb ${loadBalanceId} success`);

      return true;
    } catch (e) {
      console.log(`[CLB] Delete error: ${e.message}`);

      return false;
    }
  }

  /**
   *
   * @param {BindClbTriggerInput} 绑定
   */
  async bindTrigger({
    loadBalanceId,
    listenerId,
    locationId,
    functionName,
    namespace = 'default',
    qualifier = '$DEFAULT',
    weight = 10,
  }: BindClbTriggerInput) {
    const { RequestId } = await this.request({
      Action: 'RegisterFunctionTargets',
      LoadBalancerId: loadBalanceId,
      ListenerId: listenerId,
      LocationId: locationId,
      FunctionTargets: [
        {
          Weight: weight,
          Function: {
            FunctionName: functionName,
            FunctionNamespace: namespace,
            FunctionQualifier: qualifier,
          },
        },
      ],
    });

    // 等待规则异步创建成功
    await this.loopForStatusReady(RequestId);

    return true;
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, pascalCaseProps(data));
    return result;
  }
}
