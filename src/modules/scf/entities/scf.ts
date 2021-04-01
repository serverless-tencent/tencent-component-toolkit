import { Capi } from '@tencent-sdk/capi';
import { waitResponse } from '@ygkit/request';
import { ApiTypeError, ApiError } from '../../../utils/error';
import CONFIGS from '../config';
import { formatInputs } from '../utils';

import BaseEntity from './base';

import { ScfCreateFunctionInputs, FunctionInfo } from '../interface';

export default class ScfEntity extends BaseEntity {
  region: string;

  constructor(capi: Capi, region: string) {
    super(capi);
    this.capi = capi;
    this.region = region;
  }

  // 获取函数详情
  async get({
    functionName,
    namespace = 'default',
    qualifier = '$LATEST',
    showCode = false,
    showTriggers = false,
  }: {
    functionName: string;
    namespace?: string;
    qualifier?: string;
    // 是否需要获取函数代码，默认设置为 false，提高查询效率
    showCode?: boolean;
    // 是否需要获取函数触发器，默认设置为 false，提高查询效率
    showTriggers?: boolean;
  }): Promise<FunctionInfo | null> {
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
      if (e.code == 'ResourceNotFound.FunctionName' || e.code == 'ResourceNotFound.Function') {
        return null;
      }
      throw new ApiError({
        type: 'API_SCF_GetFunction',
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

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
        // GetFunction 接口耗时一般需要200ms左右，QPS 大概为 5，小于云 API 20 的限制
        // 所以不需要sleep
        // await sleep(500);
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
    const inp = formatInputs(this.region, inputs);
    const functionInputs = { Action: 'CreateFunction' as const, ...inp };
    await this.request(functionInputs);
    return true;
  }

  // 更新函数代码
  async updateCode(inputs: ScfCreateFunctionInputs, funcInfo: FunctionInfo) {
    console.log(`Updating function ${inputs.name} code, region ${this.region}`);
    const functionInputs = await formatInputs(this.region, inputs);
    const reqParams = {
      Action: 'UpdateFunctionCode' as const,
      Handler: functionInputs.Handler || funcInfo.Handler,
      FunctionName: functionInputs.FunctionName,
      CosBucketName: functionInputs.Code?.CosBucketName,
      CosObjectName: functionInputs.Code?.CosObjectName,
      Namespace: inputs.namespace || funcInfo.Namespace,
    };
    await this.request(reqParams);
    return true;
  }

  // 更新函数配置
  async updateConfigure(inputs: ScfCreateFunctionInputs, funcInfo: FunctionInfo) {
    console.log(`Updating function ${inputs.name} configure, region ${this.region}`);
    let reqParams = await formatInputs(this.region, inputs);

    reqParams = {
      ...reqParams,
      Timeout: inputs.timeout || funcInfo.Timeout,
      Namespace: inputs.namespace || funcInfo.Namespace,
      MemorySize: inputs.memorySize || funcInfo.MemorySize,
    };
    if (!reqParams.ClsLogsetId) {
      reqParams.ClsLogsetId = '';
      reqParams.ClsTopicId = '';
    }

    const reqInputs: Partial<typeof reqParams> = reqParams;

    // 更新函数接口不能传递一下参数
    delete reqInputs.Handler;
    delete reqInputs.Code;
    delete reqInputs.CodeSource;
    delete reqInputs.AsyncRunEnable;

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
        message: `Cannot delete function in 2 minutes, (reqId: ${res.RequestId})`,
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
}
