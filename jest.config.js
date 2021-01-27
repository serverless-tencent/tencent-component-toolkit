const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '.env.test') });

const mod = process.env.MODULE;

const config = {
  verbose: true,
  silent: false,
  testTimeout: 600000,
  testEnvironment: 'node',
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(js|ts)$',
  // 由于测试账号没有备案域名，所以线上 CI 忽略 CDN 测试
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/cdn.test.ts',
    '/__tests__/triggers/mps.test.ts',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

if (mod) {
  if (mod === 'triggers') {
    config.testRegex = `/__tests__/triggers/.*.test.(js|ts)`;
  } else {
    config.testRegex = `/__tests__/${process.env.MODULE}.test.(js|ts)`;
    config.testPathIgnorePatterns = ['/node_modules/'];
  }
}

module.exports = config;
