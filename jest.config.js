const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '.env.test') });

const mod = process.env.MODULE;

const config = {
  verbose: true,
  silent: mod ? false : true,
  testTimeout: 600000,
  testEnvironment: 'node',
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(js|ts)$',
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/cdn.test.js', '/__tests__/cynos.test.js'],
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
