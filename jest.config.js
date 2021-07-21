const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '.env.test') });

const mod = process.env.MODULE;

const config = {
  verbose: true,
  silent: process.env.CI && !mod,
  testTimeout: 600000,
  testEnvironment: 'node',
  testRegex: '/__tests__/[a-z]+/.*\\.(test|spec)\\.(js|ts)$',
  // 由于测试账号没有备案域名，所以线上 CI 忽略 CDN 测试
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/cdn/',
    '/__tests__/apigw/custom-domains.test.ts',
    '/__tests__/scf/special.test.ts', // 专门用来验证测试小地域功能发布测试
    '/__tests__/scf/image.test.ts', // 专门用来验证测试镜像函数
    '/__tests__/scf/http.test.ts', // 专门用来验证测试 HTTP 直通
    '/__tests__/triggers/mps.test.ts',
    '/__tests__/triggers/manager.test.ts',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

if (mod) {
  if (mod === 'custom-domains') {
    config.testRegex = `/__tests__/apigw/custom-domains.test.(js|ts)`;
  } else {
    if (mod.indexOf('.') !== -1) {
      const [moduleName, subModuleName] = mod.split('.');
      config.testRegex = `/__tests__/${moduleName}/${subModuleName}.test.(js|ts)`;
      config.testPathIgnorePatterns = ['/node_modules/'];
    } else {
      config.testRegex = `/__tests__/${process.env.MODULE}/.*.test.(js|ts)`;
      config.testPathIgnorePatterns = ['/node_modules/'];
    }

    if (mod === 'scf') {
      config.testPathIgnorePatterns = [
        '/node_modules/',
        '/__tests__/scf/special.test.ts', // 专门用来验证测试小地域功能发布测试
        '/__tests__/scf/image.test.ts', // 专门用来验证测试镜像函数
        '/__tests__/scf/http.test.ts', // 专门用来验证测试 HTTP 直通];
      ];
    }
    if (mod === 'triggers') {
      config.testPathIgnorePatterns = [
        '/node_modules/',
        '/__tests__/triggers/mps.test.ts',
        '/__tests__/triggers/manager.test.ts',
      ];
    }
  }
}

module.exports = config;
