import {Capi} from '@tencent-sdk/capi';
import {sleep, waitResponse} from '@ygkit/request';
import dayjs from 'dayjs';
import {ApiError, ApiTypeError} from '../../../utils/error';
import {formatDate} from '../../../utils/dayjs';
import CONFIGS from '../config';
import Cls from '../../cls';
import {formatInputs} from '../utils';

import BaseEntity from './base';

import {
  FaasBaseConfig,
  FunctionInfo,
  GetLogOptions,
  GetRequestStatusOptions,
  GpuReservedQuota,
  ScfCreateFunctionInputs,
  UpdateFunctionCodeOptions,
} from '../interface';

export default class ScfEntity extends BaseEntity {
  region: string;
  cls: Cls;

  constructor(capi: Capi, region: string) {
    super(capi);
    this.capi = capi;
    this.region = region;

    const { options } = capi;
    this.cls = new Cls(
      {
        SecretId: options.SecretId,
        SecretKey: options.SecretKey,
        Token: options.Token,
      },
      this.region,
    );
  }

  // 获取函数详情
  async get({
    functionName,
    namespace = 'default',
    qualifier = '$LATEST',
    showCode = false,
    showTriggers = false,
  }: {
    // 是否需要获取函数代码，默认设置为 false，提高查询效率
    showCode?: boolean;
    // 是否需要获取函数触发器，默认设置为 false，提高查询效率
    showTriggers?: boolean;
  } & FaasBaseConfig): Promise<FunctionInfo | null> {
    try {
      const Response = await this.request({
        Action: 'GetFunction',
        FunctionName: functionName,
        Namespace: namespace,
        Qualifier: qualifier,
        ShowCode: showCode ? 'TRUE' : 'FALSE',
        ShowTriggers: showTriggers ? 'TRUE' : 'FALSE',
      });
      return Response;
    } catch (e) {
      if (e.code === 'ResourceNotFound.FunctionName' || e.code === 'ResourceNotFound.Function') {
        return null;
      }
      if (e.code === 'InvalidParameterValue.FunctionName') {
        throw new ApiError({
          type: 'API_SCF_GetFunction',
          message: `SCF 函数名称(${functionName})命名不符合规则。 只能包含字母、数字、下划线、连字符，以字母开头，以数字或字母结尾，2~60个字符`,
          reqId: e.reqId,
          code: e.code,
          displayMsg: `SCF 函数名称(${functionName})命名不符合规则。 只能包含字母、数字、下划线、连字符，以字母开头，以数字或字母结尾，2~60个字符`,
        });
      } else {
        throw new ApiError({
          type: 'API_SCF_GetFunction',
          message: e.message,
          reqId: e.reqId,
          code: e.code,
        });
      }
    }
  }

  wait = this.checkStatus;
  // 由于函数的创建/更新是个异步过程，所以需要轮训函数状态
  // 每个 200ms（GetFunction 接口平均耗时） 轮训一次，轮训 1200 次，也就是 2 分钟
  async checkStatus({
    functionName,
    namespace = 'default',
    qualifier = '$LATEST',
  }: {
    functionName: string;
    namespace?: string;
    qualifier?: string;
  }) {
    let detail = await this.get({ namespace, functionName, qualifier });
    if (detail) {
      let { Status } = detail;
      let times = 600;
      // 轮训函数状态
      // 如果函数不存在或者状态异常，直接返回结果
      while (CONFIGS.waitStatus.indexOf(Status) !== -1 && times > 0) {
        detail = await this.get({ namespace, functionName, qualifier });
        // 函数不存在
        if (!detail) {
          return {
            isOperational: true,
            detail: detail,
          };
        }
        ({ Status } = detail);
        // 异常状态
        if (CONFIGS.failStatus.indexOf(Status) !== -1) {
          break;
        }
        await sleep(500);
        times = times - 1;
      }
      const { StatusReasons } = detail;
      return Status !== 'Active'
        ? {
            isOperational: false,
            detail: detail,
            error: {
              message:
                StatusReasons && StatusReasons.length > 0
                  ? `函数状态异常, ${StatusReasons[0].ErrorMessage}`
                  : `函数状态异常, ${Status}`,
            },
          }
        : {
            isOperational: true,
            detail: detail,
          };
    }
    return {
      isOperational: false,
      detail: detail,
      error: {
        message: `函数状态异常, 函数 ${functionName} 不存在`,
      },
    };
  }

  // 创建函数
  async create(inputs: ScfCreateFunctionInputs) {
    console.log(`Creating function ${inputs.name}, region ${this.region}`);
    const inp = formatInputs(inputs);
    const functionInputs = { Action: 'CreateFunction' as const, ...inp };
    try {
      await this.request(functionInputs);
      return true;
    } catch (error) {
      return false;
    }
  }

  // 更新函数代码
  async updateCode(inputs: ScfCreateFunctionInputs, funcInfo: FunctionInfo) {
    console.log(`Updating function ${inputs.name} code, region ${this.region}`);
    const functionInputs = await formatInputs(inputs);
    const reqParams: UpdateFunctionCodeOptions = {
      Action: 'UpdateFunctionCode' as const,
      Handler: functionInputs.Handler || funcInfo.Handler,
      FunctionName: functionInputs.FunctionName,
      // CosBucketName: functionInputs.Code?.CosBucketName,
      // CosObjectName: functionInputs.Code?.CosObjectName,
      Code: functionInputs.Code,
      Namespace: inputs.namespace || funcInfo.Namespace,
      InstallDependency: functionInputs.InstallDependency,
    };
    await this.request(reqParams);
    return true;
  }

  // 更新函数配置
  async updateConfigure(inputs: ScfCreateFunctionInputs, funcInfo: FunctionInfo) {
    console.log(`Updating function ${inputs.name} configure, region ${this.region}`);
    let reqParams = await formatInputs(inputs);

    reqParams = {
      ...reqParams,
      Timeout: inputs.timeout || funcInfo.Timeout,
      Namespace: inputs.namespace || funcInfo.Namespace,
      MemorySize: inputs.memorySize || funcInfo.MemorySize,
    };
    // 由于业务变动，后端会默认创建cls来记录日志，如果需要删除 CLS 配置，用户需要手动配置为 ’‘
    // if (!reqParams.ClsLogsetId) {
    //   reqParams.ClsLogsetId = '';
    //   reqParams.ClsTopicId = '';
    // }

    const reqInputs: Partial<typeof reqParams> = reqParams;

    // 更新函数接口不能传递以下参数
    delete reqInputs.Type;
    delete reqInputs.Handler;
    delete reqInputs.Runtime;
    delete reqInputs.Code;
    delete reqInputs.AsyncRunEnable;
    delete reqInputs.InstallDependency;
    delete reqInputs.DeployMode;
    delete reqInputs.ProtocolType;
    delete reqInputs.NodeType;
    delete reqInputs.NodeSpec;

    // +++++++++++++++++++++++
    // FIXME: 以下是函数绑定层逻辑，当函数有一个层，更新的时候想删除，需要传递参数 Layers 不能为空，必须包含特殊元素：{ LayerName: '', LayerVersion: 0 }
    if (reqInputs.Layers && reqInputs.Layers.length === 0) {
      reqInputs.Layers.push({
        LayerName: '',
        LayerVersion: 0,
      });
    }
    // FIXME: 函数移除所有环境变量逻辑，Environment 参数也需要为特殊元素数组：{ Variables: [{ Key: '', Value: '' }] }
    if (!reqInputs?.Environment?.Variables || reqInputs.Environment.Variables.length === 0) {
      reqInputs.Environment = { Variables: [{ Key: '', Value: '' }] };
    }
    await this.request({ Action: 'UpdateFunctionConfiguration', ...reqInputs });
    return true;
  }

  // 获取异步函数配置
  async getAsyncRetryConfig(inputs: ScfCreateFunctionInputs, funcInfo: FunctionInfo) {
    const reqParams = {
      Namespace: inputs.namespace || funcInfo.Namespace,
      FunctionName: inputs.name || funcInfo.FunctionName,
      Qualifier: inputs.qualifier || funcInfo.Qualifier || '$LATEST',
    };

    const reqInputs: Partial<typeof reqParams> = reqParams;

    const res = await this.request({ Action: 'GetFunctionEventInvokeConfig', ...reqInputs });
    return res;
  }
  async updateAsyncRetry(inputs: ScfCreateFunctionInputs, funcInfo: FunctionInfo) {
    console.log(`Updating function ${inputs.name} async retry configure, region ${this.region}`);
    const reqParams = {
      Namespace: inputs.namespace || funcInfo.Namespace,
      FunctionName: inputs.name || funcInfo.FunctionName,
      AsyncTriggerConfig: {
        MsgTTL: inputs.msgTTL || 21600,
        RetryConfig: [{ RetryNum: inputs.retryNum ?? 2 }],
      },
    };

    const reqInputs: Partial<typeof reqParams> = reqParams;

    await this.request({ Action: 'UpdateFunctionEventInvokeConfig', ...reqInputs });
    return true;
  }

  // delete function
  async delete({ namespace, functionName }: { namespace: string; functionName: string }) {
    namespace = namespace || CONFIGS.defaultNamespace;
    const res = await this.request({
      Action: 'DeleteFunction',
      FunctionName: functionName,
      Namespace: namespace,
    });

    try {
      await waitResponse({
        callback: async () => this.get({ namespace, functionName }),
        targetResponse: null,
        timeout: 120 * 1000,
      });
    } catch (e) {
      throw new ApiError({
        type: 'API_SCF_DeleteFunction',
        message: `删除函数是失败：${e.message}, (reqId: ${res.RequestId})`,
      });
    }
    return true;
  }

  // 轮训函数状态是否可操作
  async isOperational({
    namespace,
    functionName,
    qualifier = '$LATEST',
  }: {
    namespace: string | undefined;
    functionName: string;
    qualifier?: string;
  }) {
    const { isOperational, detail, error } = await this.checkStatus({
      namespace,
      functionName,
      qualifier,
    });
    if (isOperational === true) {
      return detail;
    }
    if (error) {
      throw new ApiTypeError('API_SCF_isOperationalStatus', error?.message);
    }
    return detail;
  }

  async tryToDelete({ namespace, functionName }: { namespace: string; functionName: string }) {
    try {
      console.log(`正在尝试删除创建失败的函数，命令空间：${namespace}，函数名称：${functionName}`);
      await this.delete({ namespace, functionName });
      await this.isOperational({ namespace, functionName });
    } catch (e) {}
  }

  /**
   * 获取函数初始状态
   * 如果函数为创建失败，则尝试删除函数，重新创建（因为创建失败的函数没法更新）
   */
  async getInitialStatus({
    namespace,
    functionName,
    qualifier = '$LATEST',
  }: {
    namespace: string;
    functionName: string;
    qualifier?: string;
  }) {
    const funcInfo = await this.get({ namespace, functionName, qualifier });
    if (funcInfo) {
      const { Status, StatusReasons } = funcInfo;
      const reason = StatusReasons && StatusReasons.length > 0 ? StatusReasons[0].ErrorMessage : '';
      if (Status === 'Active') {
        return funcInfo;
      }
      let errorMsg = '';
      switch (Status) {
        case 'Creating':
          errorMsg = '当前函数正在创建中，无法更新代码，请稍后再试';
          break;
        case 'Updating':
          errorMsg = '当前函数正在更新中，无法更新代码，请稍后再试';
          break;
        case 'Publishing':
          errorMsg = '当前函数正在版本发布中，无法更新代码，请稍后再试';
          break;
        case 'Deleting':
          errorMsg = '当前函数正在删除中，无法更新代码，请稍后再试';
          break;
        case 'CreateFailed':
          console.log(`函数创建失败，${reason || Status}`);
          await this.tryToDelete({ namespace, functionName });
          return null;
        case 'DeleteFailed':
          errorMsg = `函数删除失败，${reason || Status}`;
          break;
      }
      if (errorMsg) {
        throw new ApiTypeError('API_SCF_isOperational', errorMsg);
      }
    }

    return funcInfo;
  }

  async getClsConfig({
    functionName,
    namespace = 'default',
    qualifier = '$LATEST',
  }: FaasBaseConfig) {
    const detail = await this.get({
      functionName,
      namespace,
      qualifier,
    });

    if (detail) {
      return {
        logsetId: detail.ClsLogsetId,
        topicId: detail.ClsTopicId,
      };
    }

    return {
      logsetId: '',
      topicId: '',
    };
  }

  // 默认获取从当前到一个小时前时间段的日志
  async getLogs(data: GetLogOptions) {
    const { functionName, namespace = 'default', qualifier = '$LATEST' } = data;
    const clsConfig = await this.getClsConfig({
      functionName,
      namespace,
      qualifier,
    });

    if (!clsConfig.logsetId || !clsConfig.topicId) {
      throw new ApiTypeError('API_SCF_getClsConfig', `[SCF] 无法获取到函数的 CLS 配置`);
    }
    data.endTime = data.endTime || Date.now();

    console.log(
      `[SCF] 获取函数日志(名称：${functionName}，命名空间：${namespace}，版本：${qualifier})`,
    );
    const res = await this.cls.getLogList({
      ...data,
      ...clsConfig,
    });

    return res;
  }

  async getLogByReqId(data: GetLogOptions) {
    const clsConfig = await this.getClsConfig({
      functionName: data.functionName,
      namespace: data.namespace,
      qualifier: data.qualifier,
    });

    if (!clsConfig.logsetId || !clsConfig.topicId) {
      throw new ApiTypeError('API_SCF_getLogByReqId', `[SCF] 无法获取到函数的 CLS 配置`);
    }

    if (!data.reqId) {
      throw new ApiTypeError('API_SCF_getLogByReqId', `[SCF] 参数 reqId(请求 ID) 不合法`);
    }
    const endDate = dayjs(data.endTime || Date.now());

    console.log(`[SCF] 正在通过请求ID (${data.reqId}) 获取日志`);

    const res = await this.cls.getLogDetail({
      ...data,
      ...clsConfig,
      reqId: data.reqId!,
      endTime: formatDate(endDate),
    });

    return res;
  }

  async getDemoAddress(demoId: string) {
    try {
      const res = await this.request({
        Action: 'GetDemoAddress',
        DemoId: demoId,
      });
      return res?.DownloadAddress;
    } catch (e) {
      console.log(`[SCF] 获取模板代码失败，${e.message}`);

      return undefined;
    }
  }

  // 获取函数单个请求运行状态
  async getRequestStatus(inputs: GetRequestStatusOptions) {
    const reqParams: {
      Namespace?: string;
      FunctionName?: string;
      FunctionRequestId?: string;
      StartTime?: string;
      EndTime?: string;
    } = {
      Namespace: inputs.namespace || 'default',
      FunctionName: inputs.functionName,
      FunctionRequestId: inputs.functionRequestId,
    };

    if (inputs.startTime) {
      reqParams.StartTime = inputs.startTime
    }

    if (inputs.endTime) {
      reqParams.EndTime = inputs.endTime
    }

    const reqInputs: Partial<typeof reqParams> = reqParams;

    try {
      return await this.request({Action: 'GetRequestStatus', ...reqInputs});
    } catch (e) {
      console.log(e);
    }
  }

  // 设置Gpu函数独占配额
  async updateGpuReservedQuota(inputs: GpuReservedQuota) {
    console.log(`PutGpuReservedQuota functionName ${inputs.functionName}, region ${this.region},gpuReservedQuota ${inputs.gpuReservedQuota}`);
    const quotaInputs = { 
      Action: 'PutGpuReservedQuota' as const,
      Version: '2018-04-16',
      FunctionName:inputs?.functionName,
      GpuReservedQuota: inputs?.gpuReservedQuota
    };
    try {
      await this.request(quotaInputs);
      return true;
    } catch (error) {
      return false;
    }
  }
}
