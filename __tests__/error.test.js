const { TypeError, ApiError } = require('../src/utils/error');

describe('Custom Error', () => {
  test('TypeError', async () => {
    try {
      throw new TypeError(
        'TEST_TypeError',
        'This is a test error',
        'error stack',
        123,
        'error test',
      );
    } catch (e) {
      expect(e.type).toEqual('TEST_TypeError');
      expect(e.message).toEqual('This is a test error');
      expect(e.stack).toEqual('error stack');
      expect(e.reqId).toEqual(123);
      expect(e.displayMsg).toEqual('error test');
    }
  });
  test('ApiError', async () => {
    try {
      throw new ApiError({
        type: 'TEST_ApiError',
        message: 'This is a test error',
        stack: 'error stack',
        reqId: 123,
        code: 'abc',
        displayMsg: 'error test',
      });
    } catch (e) {
      expect(e.type).toEqual('TEST_ApiError');
      expect(e.message).toEqual('This is a test error');
      expect(e.stack).toEqual('error stack');
      expect(e.reqId).toEqual(123);
      expect(e.code).toEqual('abc');
      expect(e.displayMsg).toEqual('error test');
    }
  });
});
