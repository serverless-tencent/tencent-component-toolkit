function TypeError(type, msg, stack, reqId, displayMsg) {
  const err = new Error(msg);
  err.type = type;
  if (stack) {
    err.stack = stack;
  }
  if (reqId) {
    err.reqId = reqId;
  }
  err.displayMsg = displayMsg || msg;
  return err;
}

function ApiError({ type, message, stack, reqId, displayMsg, code }) {
  const err = new Error(message);
  err.type = type;
  if (stack) {
    err.stack = stack;
  }
  if (reqId) {
    err.reqId = reqId;
  }
  if (code) {
    err.code = code;
  }
  err.displayMsg = displayMsg || message;
  return err;
}

module.exports = {
  TypeError,
  ApiError,
};
