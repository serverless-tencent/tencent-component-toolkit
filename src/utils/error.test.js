const assert = require('assert');
const { TypeError } = require('./error');

try {
  throw new TypeError('TEST_ERROR', 'This is a test error', null,  123, 'error test');
} catch (e) {
  assert.equal(e.type, 'TEST_ERROR');
  assert.equal(e.message, 'This is a test error');
  assert.equal(typeof e.stack, 'string');
  assert.equal(e.reqId, 123);
  assert.equal(e.displayMsg, 'error test');
}
