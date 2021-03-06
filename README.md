# Tencent Component Toolkit

[![npm](https://img.shields.io/npm/v/tencent-component-toolkit)](http://www.npmtrends.com/tencent-component-toolkit)
[![NPM downloads](http://img.shields.io/npm/dm/tencent-component-toolkit.svg?style=flat-square)](http://www.npmtrends.com/tencent-component-toolkit)
[![Build Status](https://github.com/serverless-tencent/tencent-component-toolkit/workflows/Release/badge.svg?branch=master)](https://github.com/serverless-tencent/tencent-component-toolkit/actions?query=workflow:Release+branch:master)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

Tencent component toolkit.

## Usage

```bash
$ npm install tencent-component-toolkit --save
```

## Development

All `git commit` mesage must follow below syntax:

```bash
type(scope?): subject  #scope is optional
```

support type：

- **feat**: add new feature
- **fix**: fix bug or patch feature
- **ci**: CI
- **chore**: modify config, nothing to do with production code
- **docs**: create or modifiy documents
- **refactor**: refactor project
- **revert**: revert
- **test**: test

Most of time, we just use `feat` and `fix`.

## Test

For running integration tests we should setup some environment variables in `.env.test` locally or `secrets` in CI.

Just copy `.env.example` to `.env.test`, then change to test account.

## License

Copyright (c) 2019-present Tencent Cloud, Inc.
