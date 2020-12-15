const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '.env.test') });

const md = process.env.MODULE;

const config = {
  verbose: true,
  silent: md ? false : true,
  testTimeout: 60000,
  testEnvironment: 'node',
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(js|ts)$',
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/cdn.test.js', '/__tests__/cynos.test.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

if (md) {
  if (md === 'triggers') {
    // config.testRegex = `/__tests__/triggers/.*.test.js`;
    config.testRegex = `/__tests__/triggers/mps.test.js`;
  } else {
    config.testRegex = `/__tests__/${process.env.MODULE}.test.js`;
    config.testPathIgnorePatterns = ['/node_modules/'];
  }
}

module.exports = config;
