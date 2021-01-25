export class ApiTypeError extends Error {
  type: string;
  stack?: string;
  reqId?: string;
  displayMsg: string;

  constructor(type: string, msg: string, stack?: string, reqId?: string, displayMsg?: string) {
    super(msg);

    this.type = type;
    this.displayMsg = displayMsg ?? msg;
    if (stack) {
      this.stack = stack;
    }
    if (reqId) {
      this.reqId = reqId;
    }
  }
}

/** @deprecated 不要使用和 JS 默认错误类型重名的 TypeError，可用 ApiTypeError 代替 */
export const TypeError = ApiTypeError;

interface ApiErrorOptions {
  message: string;
  stack?: string;
  type: string;
  reqId?: string;
  code?: string;
  displayMsg?: string;
}

export class ApiError extends Error {
  type: string;
  reqId?: string;
  code?: string;
  displayMsg: string;

  constructor({ type, message, stack, reqId, displayMsg, code }: ApiErrorOptions) {
    super(message);
    this.type = type;
    if (stack) {
      this.stack = stack;
    }
    if (reqId) {
      this.reqId = reqId;
    }
    if (code) {
      this.code = code;
    }
    this.displayMsg = displayMsg ?? message;
    return this;
  }
}
