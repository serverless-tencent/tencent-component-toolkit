const assert = require('assert');
const { TypeError } = require('./error');

try {
  throw new TypeError('TEST_ERROR', 'This is a test error');
} catch (e) {
  assert.equal(e.type, 'TEST_ERROR');
  assert.equal(e.message, 'This is a test error');
}
