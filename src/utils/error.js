function TypeError(type, msg, stack, reqId) {
  const err = new Error(msg);
  err.type = type;
  err.stack = stack || null;
  if (reqId) {
    err.reqId = reqId;
  }
  return err;
}

module.exports = {
  TypeError,
};
