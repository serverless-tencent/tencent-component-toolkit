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

module.exports = {
  TypeError,
};
