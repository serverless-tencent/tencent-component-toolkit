const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '.env.test') });

const config = {
  verbose: true,
  silent: true,
  testTimeout: 60000,
  testEnvironment: 'node',
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(js|ts)$',
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/cdn.test.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

if (process.env.MODULE) {
  config.testRegex = `/__tests__/${process.env.MODULE}.test.js`;
  config.testPathIgnorePatterns = ['/node_modules/'];
}

module.exports = config;
