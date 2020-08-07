const { slsMonitor } = require('tencent-cloud-sdk');
const assert = require('assert');
const moment = require('moment');
const util = require('util');
const url = require('url');
const { TypeError } = require('../../utils/error');

class Metrics {
  constructor(credentials = {}, options = {}) {
    this.region = options.region || 'ap-guangzhou';
    this.credentials = credentials;
    assert(options.funcName, 'function name should not is empty');
    this.funcName = options.funcName;
    this.namespace = options.namespace || 'default';
    this.version = options.version || '$LATEST';
    this.apigwServiceId = options.apigwServiceId;
    this.apigwEnvironment = options.apigwEnvironment;

    this.client = new slsMonitor(this.credentials);
    this.timezone = options.timezone || '+08:00';
  }

  static get Type() {
    return Object.freeze({
      Base: 1, // scf base metrics
      Custom: 2, // report custom metrics
      Apigw: 4, // apigw metrics
      All: 0xffffffff,
    });
  }

  async scfMetrics(startTime, endTime, period) {
    const rangeTime = {
      rangeStart: startTime,
      rangeEnd: endTime,
    };
    try {
      const responses = await this.client.getScfMetrics(
        this.region,
        rangeTime,
        period,
        this.funcName,
        this.namespace,
        this.version,
      );
      return responses;
    } catch (e) {
      throw new TypeError(`API_METRICS_getScfMetrics`, e.message, e.stack);
    }
  }

  async apigwMetrics(startTime, endTime, period, serviceId, env) {
    const rangeTime = {
      rangeStart: startTime,
      rangeEnd: endTime,
    };

    try {
      const responses = await this.client.getApigwMetrics(
        this.region,
        rangeTime,
        period,
        serviceId,
        env,
      );
      return responses;
    } catch (e) {
      throw new TypeError(`API_METRICS_getApigwMetrics`, e.message, e.stack);
    }
  }

  async customMetrics(startTime, endTime, period) {
    const rangeTime = {
      rangeStart: startTime,
      rangeEnd: endTime,
    };

    const instances = [
      util.format(
        '%s|%s|%s',
        this.namespace || 'default',
        this.funcName,
        this.version || '$LATEST',
      ),
    ];
    try {
      const responses = await this.client.getCustomMetrics(
        this.region,
        instances,
        rangeTime,
        period,
      );
      return responses;
    } catch (e) {
      throw new TypeError(`API_METRICS_getCustomMetrics`, e.message, e.stack);
    }
  }

  async getDatas(startTime, endTime, metricsType = Metrics.Type.All) {
    startTime = moment(startTime);
    endTime = moment(endTime);

    if (endTime <= startTime) {
      throw new TypeError(`PARAMETER_METRICS`, 'The rangeStart provided is after the rangeEnd');
    }

    if (startTime.isAfter(endTime)) {
      throw new TypeError(`PARAMETER_METRICS`, 'The rangeStart provided is after the rangeEnd');
    }

    // custom metrics maximum 8 day
    if (startTime.diff(endTime, 'days') >= 8) {
      throw new TypeError(
        `PARAMETER_METRICS`,
        `The range cannot be longer than 8 days.  The supplied range is: ${startTime.diff(
          endTime,
          'days',
        )}`,
      );
    }

    let period;
    const diffMinutes = endTime.diff(startTime, 'minutes');
    if (diffMinutes <= 16) {
      // 16 mins
      period = 60; // 1 min
    } else if (diffMinutes <= 61) {
      // 1 hour
      period = 300; // 5 mins
    } else if (diffMinutes <= 1500) {
      // 24 hours
      period = 3600; // hour
    } else {
      period = 86400; // day
    }

    let response, results;
    if (metricsType & Metrics.Type.Base) {
      const timeFormat = 'YYYY-MM-DDTHH:mm:ss' + this.timezone;
      results = await this.scfMetrics(
        startTime.format(timeFormat),
        endTime.format(timeFormat),
        period,
      );
      response = this.buildMetrics(results);
    }

    if (metricsType & Metrics.Type.Custom) {
      if (!response) {
        response = {
          rangeStart: startTime.format('YYYY-MM-DD HH:mm:ss'),
          rangeEnd: endTime.format('YYYY-MM-DD HH:mm:ss'),
          metrics: [],
        };
      }
      results = await this.customMetrics(
        startTime.format('YYYY-MM-DD HH:mm:ss'),
        endTime.format('YYYY-MM-DD HH:mm:ss'),
        period,
      );
      results = this.buildCustomMetrics(results);
      response.metrics = response.metrics.concat(results);
    }

    if (metricsType & Metrics.Type.Apigw) {
      if (!response) {
        response = {
          rangeStart: startTime.format('YYYY-MM-DD HH:mm:ss'),
          rangeEnd: endTime.format('YYYY-MM-DD HH:mm:ss'),
          metrics: [],
        };
      }

      results = await this.apigwMetrics(
        startTime.format('YYYY-MM-DD HH:mm:ss'),
        endTime.format('YYYY-MM-DD HH:mm:ss'),
        period,
        this.apigwServiceId,
        this.apigwEnvironment,
      );

      results = this.buildApigwMetrics(results);
      response.metrics = response.metrics.concat(results.metrics);
      if (results.startTime) {
        response.rangeStart = results.startTime;
      }
      if (results.endTime) {
        response.rangeEnd = results.endTime;
      }
    }
    return response;
  }

  buildApigwMetrics(datas) {
    const responses = {
      startTime: '',
      endTime: '',
      metrics: [],
    };

    for (let i = 0; i < datas.length; i++) {
      const metric = datas[i].Response;
      if (metric.Error) {
        continue;
      }
      responses.startTime = metric.StartTime;
      responses.endTime = metric.EndTime;

      let type = 'count';
      const result = {
        type: 'stacked-bar',
        x: {
          type: 'timestamp',
          values: metric.DataPoints[0].Timestamps.map((ts) => ts * 1000),
        },
        y: [],
      };
      switch (metric.MetricName) {
        case 'NumOfReq':
          result.title = 'apigw total request num';
          break;
        case 'ResponseTime':
          type = 'duration';
          result.title = 'apigw request response time(ms)';
          break;
      }

      const item = {
        name: metric.MetricName,
        type: type,
        values: metric.DataPoints[0].Values,
        total: metric.DataPoints[0].Values.reduce(function(a, b) {
          return a + b;
        }, 0),
      };

      if (!(~~item.total == item.total)) {
        item.total = parseFloat(item.total.toFixed(2), 10);
      }

      if (result.x.values.length == 0) {
        const startTime = moment(responses.startTime);
        const endTime = moment(responses.endTime);

        i = 0;
        while (startTime <= endTime) {
          result.x.values[i] = startTime.unix() * 1000;
          item.values[i] = 0;
          i++;
          startTime.add(metric.Period, 's');
        }

        item.total = 0;
      }

      result.y.push(item);
      responses.metrics.push(result);
    }

    return responses;
  }

  buildMetrics(datas) {
    const filterMetricByName = function(metricName, metrics) {
      const len = metrics.length;

      for (var i = 0; i < len; i++) {
        if (metrics[i].Response.MetricName == metricName) {
          return metrics[i].Response;
        }
      }
      return null;
    };

    const response = {
      rangeStart: datas[0].Response.StartTime,
      rangeEnd: datas[0].Response.EndTime,
      metrics: [],
    };

    const funcInvAndErr = {
      type: 'stacked-bar',
      title: 'function invocations & errors',
    };

    // build Invocation & error
    const invocations = filterMetricByName('Invocation', datas);
    if (invocations && invocations.DataPoints[0].Timestamps.length > 0) {
      funcInvAndErr.x = {
        type: 'timestamp',
      };
      if (!funcInvAndErr.y) {
        funcInvAndErr.y = [];
      }

      response.rangeStart = invocations.StartTime;
      response.rangeEnd = invocations.EndTime;

      funcInvAndErr.x.values = invocations.DataPoints[0].Timestamps.map((ts) => ts * 1000);

      const funcInvItem = {
        name: invocations.MetricName.toLocaleLowerCase(),
        type: 'count',
        total: invocations.DataPoints[0].Values.reduce(function(a, b) {
          return a + b;
        }, 0),
        values: invocations.DataPoints[0].Values,
      };
      funcInvAndErr.y.push(funcInvItem);
    }
    const errors = filterMetricByName('Error', datas);
    if (errors && errors.DataPoints[0].Timestamps.length > 0) {
      funcInvAndErr.x = {
        type: 'timestamp',
      };
      if (!funcInvAndErr.y) {
        funcInvAndErr.y = [];
      }

      response.rangeStart = errors.StartTime;
      response.rangeEnd = errors.EndTime;

      funcInvAndErr.x.values = errors.DataPoints[0].Timestamps.map((ts) => ts * 1000);

      const funcErrItem = {
        name: errors.MetricName.toLocaleLowerCase(),
        type: 'count',
        color: 'error',
        total: errors.DataPoints[0].Values.reduce(function(a, b) {
          return a + b;
        }, 0),
        values: errors.DataPoints[0].Values,
      };
      funcInvAndErr.y.push(funcErrItem);
    }
    if (
      (!invocations || invocations.DataPoints[0].Timestamps.length == 0) &&
      (!errors || errors.DataPoints[0].Timestamps.length == 0)
    ) {
      funcInvAndErr.type = 'empty';
    }

    response.metrics.push(funcInvAndErr);

    const latency = {
      type: 'multiline', // constant
      title: 'function latency', // constant
    };
    let latencyP50 = filterMetricByName('Duration-P50', datas);
    let latencyP95 = filterMetricByName('Duration-P95', datas);
    if (latencyP50 == null) {
      latencyP50 = filterMetricByName('Duration', datas);
    }
    if (latencyP95 == null) {
      latencyP95 = filterMetricByName('Duration', datas);
    }

    if (latencyP95 && latencyP95.DataPoints[0].Timestamps.length > 0) {
      latency.x = {
        type: 'timestamp',
      };
      if (!latency.y) {
        latency.y = [];
      }

      response.rangeStart = latencyP95.StartTime;
      response.rangeEnd = latencyP95.EndTime;
      latency.x.values = latencyP95.DataPoints[0].Timestamps.map((ts) => ts * 1000);

      const p95 = {
        name: 'p95 latency', // constant
        type: 'duration', // constant
        total: Math.max(...latencyP95.DataPoints[0].Values),
        values: latencyP95.DataPoints[0].Values,
      };
      if (!(~~p95.total == p95.total)) {
        p95.total = parseFloat(p95.total.toFixed(2), 10);
      }
      latency.y.push(p95);
    }

    if (latencyP50 && latencyP50.DataPoints[0].Timestamps.length > 0) {
      latency.x = {
        type: 'timestamp',
      };
      if (!latency.y) {
        latency.y = [];
      }
      response.rangeStart = latencyP50.StartTime;
      response.rangeEnd = latencyP50.EndTime;
      latency.x.values = latencyP50.DataPoints[0].Timestamps.map((ts) => ts * 1000);

      const p50 = {
        name: 'p50 latency', // constant
        type: 'duration', // constant
        total: Math.max(...latencyP50.DataPoints[0].Values),
        values: latencyP50.DataPoints[0].Values,
      };
      if (!(~~p50.total == p50.total)) {
        p50.total = parseFloat(p50.total.toFixed(2), 10);
      }
      latency.y.push(p50);
    }

    if (
      (!latencyP50 || latencyP50.DataPoints[0].Timestamps.length == 0) &&
      (!latencyP95 || latencyP95.DataPoints[0].Timestamps.length == 0)
    ) {
      latency.type = 'empty';
    }

    response.metrics.push(latency);

    return response;
  }

  buildCustomMetrics(responses) {
    const filterMetricByName = function(metricName, metrics, all) {
      const len = metrics.length;
      const results = [];
      for (var i = 0; i < len; i++) {
        if (metrics[i].Response.Error) {
          continue;
        }
        if (
          metrics[i].Response.Data.length > 0 &&
          metrics[i].Response.Data[0].AttributeName.match(metricName)
        ) {
          if (all) {
            results.push(metrics[i].Response.Data[0]);
          } else {
            return metrics[i].Response.Data[0];
          }
        }
      }
      return all ? results : null;
    };

    const hex2path = function(hexPath) {
      const len = hexPath.length;
      let path = '';
      for (let i = 0; i < len; ) {
        const char = hexPath.slice(i, i + 2);
        if (isNaN(parseInt(char, 16))) {
          return null;
        }
        path += String.fromCharCode(parseInt(char, 16));
        i += 2;
      }
      return path.toLocaleLowerCase();
    };

    const parseErrorPath = function(m, path) {
      const ret = path.match(m);
      if (!ret) {
        return null;
      }

      const method = ret[1];
      const hexPath = ret[2];
      const code = parseInt(ret[3], 10);

      const pathObj = url.parse(hex2path(hexPath));

      return {
        method: method.toLocaleUpperCase(),
        path: pathObj ? pathObj.pathname : hex2path(hexPath),
        code: code,
      };
    };

    const parsePath = function(m, path) {
      const ret = path.match(m);
      if (!ret) {
        return null;
      }

      const method = ret[1];
      const hexPath = ret[2];

      const pathObj = url.parse(hex2path(hexPath));

      return {
        method: method.toLocaleUpperCase(),
        path: pathObj ? pathObj.pathname : hex2path(hexPath),
      };
    };

    const makeMetric = function(name, metricData) {
      const data = {
        name: name,
        type: 'duration',
        values: metricData.Values.map((item) => {
          return item.Value;
        }),
      };

      data.total = data.values.reduce(function(a, b) {
        return a + b;
      }, 0);

      if (!(~~data.total == data.total)) {
        data.total = parseFloat(data.total.toFixed(2), 10);
      }
      return data;
    };
    const results = [];
    const requestDatas = filterMetricByName(/^request$/, responses);
    const errorDatas = filterMetricByName(/^error$/, responses);
    const apiReqAndErr = {
      type: 'stacked-bar',
      title: 'api requests & errors',
    };
    if (requestDatas) {
      apiReqAndErr.x = {
        type: 'timestamp',
      };
      if (!apiReqAndErr.y) {
        apiReqAndErr.y = [];
      }

      apiReqAndErr.x.values = requestDatas.Values.map((item) => {
        return item.Timestamp * 1000;
      });
      const ret = makeMetric('requests', requestDatas);
      ret.type = 'count';
      apiReqAndErr.y.push(ret);
    }

    if (errorDatas) {
      apiReqAndErr.x = {
        type: 'timestamp',
      };
      if (!apiReqAndErr.y) {
        apiReqAndErr.y = [];
      }

      apiReqAndErr.x.values = errorDatas.Values.map((item) => {
        return item.Timestamp * 1000;
      });
      const errObj = makeMetric('errors', errorDatas);
      errObj.color = 'error';
      errObj.type = 'count';
      apiReqAndErr.y.push(errObj);
    }

    if (!requestDatas && !errorDatas) {
      apiReqAndErr.type = 'empty';
    }

    results.push(apiReqAndErr);

    // request latency
    let latencyP95Datas, latencyP50Datas;
    const latency = {
      title: 'api latency',
      type: 'multiline',
    };
    if (requestDatas) {
      latencyP95Datas = filterMetricByName(/^latency-P95$/, responses);
      latencyP50Datas = filterMetricByName(/^latency-P50$/, responses);

      if (latencyP50Datas == null) {
        latencyP50Datas = filterMetricByName(/^latency$/, responses);
      }
      if (latencyP95Datas == null) {
        latencyP95Datas = filterMetricByName(/^latency$/, responses);
      }
      if (latencyP95Datas) {
        if (!latency.y) {
          latency.y = [];
        }

        latency.x = {
          type: 'timestamp',
        };
        latency.x.values = requestDatas.Values.map((item) => {
          return item.Timestamp * 1000;
        });
        const p95Obj = makeMetric('p95 latency', latencyP95Datas);
        p95Obj.total = Math.max(...p95Obj.values);
        latency.y.push(p95Obj);
      }

      if (latencyP50Datas) {
        if (!latency.y) {
          latency.y = [];
        }

        latency.x = {
          type: 'timestamp',
        };
        latency.x.values = requestDatas.Values.map((item) => {
          return item.Timestamp * 1000;
        });
        const p50Obj = makeMetric('p50 latency', latencyP50Datas);
        p50Obj.total = Math.max(...p50Obj.values);
        latency.y.push(p50Obj);
      }
    }

    if (!latencyP50Datas && !latencyP95Datas) {
      latency.type = 'empty';
    }

    results.push(latency);

    // request 5xx error
    const err5xx = {
      type: 'stacked-bar', // the chart widget type will use this
      title: 'api 5xx errors',
    };
    const err5xxDatas = filterMetricByName(/^5xx$/, responses);
    if (err5xxDatas) {
      err5xx.y = [];
      err5xx.x = {
        type: 'timestamp',
      };
      err5xx.x.values = err5xxDatas.Values.map((item) => {
        return item.Timestamp * 1000;
      });
      const errRet = makeMetric('5xx', err5xxDatas);
      errRet.color = 'error';
      errRet.type = 'count';
      err5xx.y.push(errRet);
    } else {
      err5xx.type = 'empty';
    }

    results.push(err5xx);

    // request 4xx error
    const err4xxDatas = filterMetricByName(/^4xx$/, responses);
    const err4xx = {
      type: 'stacked-bar', // the chart widget type will use this
      title: 'api 4xx errors',
    };
    if (err4xxDatas) {
      err4xx.y = [];
      err4xx.x = {
        type: 'timestamp',
      };
      err4xx.x.values = err4xxDatas.Values.map((item) => {
        return item.Timestamp * 1000;
      });
      const errRet = makeMetric('4xx', err4xxDatas);
      errRet.color = 'error';
      errRet.type = 'count';
      err4xx.y.push(errRet);
    } else {
      err4xx.type = 'empty';
    }

    results.push(err4xx);

    // api request error
    const apiPathRequest = {
      type: 'list-flat-bar', // constant
      title: 'api errors', // constant
    };
    const pathStatusDatas = filterMetricByName(
      /^(GET|POST|DEL|DELETE|PUT|OPTIONS|HEAD)_(.*)_(\d+)$/i,
      responses,
      true,
    );
    const pathLen = pathStatusDatas.length;
    if (pathLen > 0) {
      apiPathRequest.x = {
        type: 'string',
      };
      apiPathRequest.y = [];
      apiPathRequest.color = 'error';

      const pathHash = {};
      const recordHash = {};
      for (let i = 0; i < pathLen; i++) {
        const pathData = pathStatusDatas[i];
        const path = parseErrorPath(
          /^(GET|POST|DEL|DELETE|PUT|OPTIONS|HEAD)_([a-zA-Z0-9]+)_(\d+)$/i,
          pathData.AttributeName,
        );
        if (path.code < 400) {
          continue;
        }
        const val = `${path.method} - ${path.path}`;

        let total = 0;
        pathData.Values.map((item) => {
          total += item.Value;
        });
        if (!(~~total == total)) {
          total = parseFloat(total.toFixed(2), 10);
        }

        if (!pathHash[val]) {
          pathHash[val] = 1;
        } else {
          pathHash[val]++;
        }

        if (!recordHash[path.code]) {
          recordHash[path.code] = {};
        }

        recordHash[path.code][val] = total;
      }
      apiPathRequest.x.values = Object.keys(pathHash);

      for (const key in recordHash) {
        const item = recordHash[key];
        const errItem = {
          name: key, // the http error code
          type: 'count', // constant
          total: 0,
          values: null,
        };
        const codeVals = [];
        let total = 0;
        for (var i = 0; i < apiPathRequest.x.values.length; i++) {
          const path = apiPathRequest.x.values[i];

          codeVals.push(item[path] || 0);
          total += item[path] || 0;
        }
        errItem.values = codeVals;
        errItem.total = total;
        apiPathRequest.y.push(errItem);
      }
    } else {
      apiPathRequest.type = 'empty';
    }

    results.push(apiPathRequest);

    // total request
    const requestTotal = {
      type: 'list-details-bar', // constant
      title: 'api path requests', // constant
    };

    const pathRequestRegExp = /^(GET|POST|DEL|DELETE|PUT|OPTIONS|HEAD)_([a-zA-Z0-9]+)$/i;
    const pathLatencyRegExp = /^(GET|POST|DEL|DELETE|PUT|OPTIONS|HEAD)_([a-zA-Z0-9]+)_latency$/i;
    const pathRequestDatas = filterMetricByName(pathRequestRegExp, responses, true);
    const pathLatencyDatas = filterMetricByName(pathLatencyRegExp, responses, true);

    const pathRequestHash = {};
    // let requestTotalNum = 0
    const pathRequestDatasLen = pathRequestDatas.length;
    for (i = 0; i < pathRequestDatasLen; i++) {
      const pathRequestItem = pathRequestDatas[i];
      const path = parsePath(pathRequestRegExp, pathRequestItem.AttributeName);
      const val = `${path.method} - ${path.path}`;

      let total = 0;
      pathRequestItem.Values.map((item) => {
        total += item.Value;
      });
      if (!(~~total == total)) {
        total = parseFloat(total.toFixed(2), 10);
      }

      if (!pathRequestHash[val]) {
        pathRequestHash[val] = total;
      } else {
        pathRequestHash[val] += total;
      }
    }

    const pathLatencyHash = {};
    const pathLatencyLen = pathLatencyDatas.length;
    for (i = 0; i < pathLatencyLen; i++) {
      const pathLatencyItem = pathLatencyDatas[i];
      const path = parsePath(pathLatencyRegExp, pathLatencyItem.AttributeName);
      const val = `${path.method} - ${path.path}`;

      let total = 0;
      pathLatencyItem.Values.map((item) => {
        total += item.Value;
      });

      total = total / pathLatencyItem.Values.length;
      if (!(~~total == total)) {
        total = parseFloat(total.toFixed(2), 10);
      }

      if (!pathLatencyHash[val]) {
        pathLatencyHash[val] = total;
      } else {
        pathLatencyHash[val] += total;
      }
    }
    const pathRequestValues = {
      name: 'requests', // constant
      type: 'count', // constant
      total: 0,
      values: [],
    };
    const pathLatencyValues = {
      name: 'avg latency', // constant
      type: 'duration', // constant
      total: 0,
      values: [],
    };
    for (const key in pathRequestHash) {
      const reqNum = pathRequestHash[key];
      pathRequestValues.values.push(reqNum || 0);
      pathRequestValues.total += reqNum || 0;
      if (!(~~pathRequestValues.total == pathRequestValues.total)) {
        pathRequestValues.total = parseFloat(pathRequestValues.total.toFixed(2), 10);
      }

      const latencyNum = pathLatencyHash[key];
      pathLatencyValues.values.push(latencyNum || 0);
      pathLatencyValues.total += latencyNum || 0;

      if (!(~~pathLatencyValues.total == pathLatencyValues.total)) {
        pathLatencyValues.total = parseFloat(pathLatencyValues.total.toFixed(2), 10);
      }
    }

    const apiPaths = Object.keys(pathRequestHash);
    if (apiPaths.length > 0) {
      requestTotal.x = {
        type: 'string',
      };
      requestTotal.y = [];
      requestTotal.x.values = apiPaths;
      requestTotal.y.push(pathRequestValues);
      requestTotal.y.push(pathLatencyValues);
    } else {
      requestTotal.type = 'empty';
    }

    results.push(requestTotal);

    return results;
  }
}

module.exports = Metrics;
