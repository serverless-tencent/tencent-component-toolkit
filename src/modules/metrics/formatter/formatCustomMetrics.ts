import { filterMetricByNameExp, makeMetric, parseErrorPath, parsePath } from '../utils';
import { MetricsResponseList, MetricsItem, MetricsDataY, MetricsData } from './../interface';

export function formatApiReqAndErrMetrics(requestDatas: MetricsData[], errorDatas: MetricsData[]) {
  const apiReqAndErr: MetricsItem = {
    type: 'stacked-bar',
    title: 'api requests & errors',
  };

  const requestData = requestDatas[0];
  if (requestData) {
    apiReqAndErr.x = {
      type: 'timestamp',
    };
    if (!apiReqAndErr.y) {
      apiReqAndErr.y = [];
    }

    apiReqAndErr.x.values = requestData.Values.map((item) => {
      return item.Timestamp * 1000;
    });
    const ret = makeMetric('requests', requestData);
    ret.type = 'count';
    apiReqAndErr.y.push(ret);
  }

  const errorData = errorDatas[0];
  if (errorData) {
    apiReqAndErr.x = {
      type: 'timestamp',
    };
    if (!apiReqAndErr.y) {
      apiReqAndErr.y = [];
    }

    apiReqAndErr.x.values = errorData.Values.map((item) => {
      return item.Timestamp * 1000;
    });
    const errObj = makeMetric('errors', errorData);
    errObj.color = 'error';
    errObj.type = 'count';
    apiReqAndErr.y.push(errObj);
  }

  if (!requestData && !errorData) {
    apiReqAndErr.type = 'empty';
  }
  return apiReqAndErr;
}

export function formatCustomMetrics(resList: MetricsResponseList) {
  const results: MetricsItem[] = [];

  const requestDatas = filterMetricByNameExp(/^request$/, resList);
  const errorDatas = filterMetricByNameExp(/^error$/, resList);
  const apiReqAndErrMetrics = formatApiReqAndErrMetrics(requestDatas, errorDatas);
  results.push(apiReqAndErrMetrics);

  // request latency
  const latency: MetricsItem = {
    title: 'api latency',
    type: 'multiline',
  };
  const latencyList = [
    {
      name: 'P95',
      regex: /^latency-P95$/,
    },
    {
      name: 'P50',
      regex: /^latency-P50$/,
    },
  ];

  const latencyDetailList = latencyList.map((item) => {
    const datas =
      filterMetricByNameExp(item.regex, resList) ?? filterMetricByNameExp(/^latency$/, resList);
    return {
      name: item.name,
      regex: item.regex,
      data: datas[0],
    };
  });

  if (requestDatas) {
    for (const latencyDetail of latencyDetailList) {
      if (!latency.y) {
        latency.y = [];
      }

      latency.x = {
        type: 'timestamp',
      };

      latency.x.values = requestDatas[0].Values.map((item) => {
        return item.Timestamp * 1000;
      });

      const y = makeMetric(`${latencyDetail.name} latency`, latencyDetail.data);

      y.total = Math.max(...y.values);
      latency.y.push(y);
    }
  }

  if (latencyDetailList.every((item) => !item.data)) {
    latency.type = 'empty';
  }

  results.push(latency);

  // 5xx 4xx request error
  const errList = ['5xx', '4xx'];

  for (const errName of errList) {
    const errItem: MetricsItem = {
      type: 'stacked-bar', // the chart widget type will use this
      title: `api ${errName} errors`,
    };
    const errDatas = filterMetricByNameExp(new RegExp(`^${errName}$`), resList);
    const errData = errDatas[0];
    if (errData) {
      errItem.y = [];
      errItem.x = {
        type: 'timestamp',
      };

      errItem.x.values = errData.Values.map((item) => {
        return item.Timestamp * 1000;
      });
      const errRet = makeMetric(errName, errData);
      errRet.color = 'error';
      errRet.type = 'count';
      errItem.y.push(errRet);
    } else {
      errItem.type = 'empty';
    }

    results.push(errItem);
  }

  // api request error
  const apiPathRequest: MetricsItem = {
    color: '',
    type: 'list-flat-bar', // constant
    title: 'api errors', // constant
  };
  const pathStatusDatas = filterMetricByNameExp(
    /^(GET|POST|DEL|DELETE|PUT|OPTIONS|HEAD)_(.*)_(\d+)$/i,
    resList,
    true,
  );

  if (pathStatusDatas.length > 0) {
    apiPathRequest.x = {
      type: 'string',
    };
    apiPathRequest.y = [];
    apiPathRequest.color = 'error';

    const pathHash: Record<string, number> = {};
    const recordHash: Record<string, Record<string, number>> = {};
    for (let i = 0; i < pathStatusDatas.length; i++) {
      const pathData = pathStatusDatas[i];
      const path = parseErrorPath(
        /^(GET|POST|DEL|DELETE|PUT|OPTIONS|HEAD)_([a-zA-Z0-9]+)_(\d+)$/i,
        pathData.AttributeName,
      );
      if (path?.code! < 400) {
        continue;
      }
      const val = `${path?.method} - ${path?.path}`;

      let total = 0;
      pathData.Values.map((item) => {
        total += item.Value;
      });
      if (!(~~total == total)) {
        total = parseFloat(total.toFixed(2));
      }

      if (!pathHash[val]) {
        pathHash[val] = 1;
      } else {
        pathHash[val]++;
      }

      if (!recordHash[path?.code!]) {
        recordHash[path?.code!] = {};
      }

      recordHash[path?.code!][val] = total;
    }
    apiPathRequest.x.values = Object.keys(pathHash);

    for (const key in recordHash) {
      const item = recordHash[key];
      const errItem = {
        name: key, // the http error code
        type: 'count', // constant
        total: 0,
        values: [] as number[],
      };
      const codeVals = [];
      let total = 0;
      for (var i = 0; i < apiPathRequest?.x?.values!.length; i++) {
        const path = apiPathRequest?.x?.values![i];

        codeVals.push(item[path] ?? 0);
        total += item[path] ?? 0;
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
  const requestTotal: MetricsItem = {
    type: 'list-details-bar', // constant
    title: 'api path requests', // constant
  };

  const pathRequestRegExp = /^(GET|POST|DEL|DELETE|PUT|OPTIONS|HEAD)_([a-zA-Z0-9]+)$/i;
  const pathLatencyRegExp = /^(GET|POST|DEL|DELETE|PUT|OPTIONS|HEAD)_([a-zA-Z0-9]+)_latency$/i;
  const pathRequestDatas = filterMetricByNameExp(pathRequestRegExp, resList, true);
  const pathLatencyDatas = filterMetricByNameExp(pathLatencyRegExp, resList, true);

  const pathRequestHash: Record<string, number> = {};
  for (i = 0; i < pathRequestDatas?.length; i++) {
    const pathRequestItem = pathRequestDatas[i];
    const path = parsePath(pathRequestRegExp, pathRequestItem.AttributeName);
    const val = `${path?.method} - ${path?.path}`;

    let total = 0;
    pathRequestItem.Values.map((item) => {
      total += item.Value;
    });
    if (!(~~total == total)) {
      total = parseFloat(total.toFixed(2));
    }

    if (!pathRequestHash[val]) {
      pathRequestHash[val] = total;
    } else {
      pathRequestHash[val] += total;
    }
  }

  const pathLatencyHash: Record<string, number> = {};
  for (i = 0; i < pathLatencyDatas.length; i++) {
    const pathLatencyItem = pathLatencyDatas[i];
    const path = parsePath(pathLatencyRegExp, pathLatencyItem.AttributeName);
    const val = `${path?.method} - ${path?.path}`;

    let total = 0;
    pathLatencyItem.Values.map((item) => {
      total += item.Value;
    });

    total = total / pathLatencyItem.Values.length;
    if (!(~~total == total)) {
      total = parseFloat(total.toFixed(2));
    }

    if (!pathLatencyHash[val]) {
      pathLatencyHash[val] = total;
    } else {
      pathLatencyHash[val] += total;
    }
  }
  const pathRequestValues: MetricsDataY = {
    name: 'requests', // constant
    type: 'count', // constant
    total: 0,
    values: [],
  };
  const pathLatencyValues: MetricsDataY = {
    name: 'avg latency', // constant
    type: 'duration', // constant
    total: 0,
    values: [],
  };
  for (const key in pathRequestHash) {
    const reqNum = pathRequestHash[key];
    pathRequestValues.values.push(reqNum ?? 0);
    pathRequestValues.total += reqNum || 0;
    if (!(~~pathRequestValues.total == pathRequestValues.total)) {
      pathRequestValues.total = parseFloat(pathRequestValues.total.toFixed(2));
    }

    const latencyNum = pathLatencyHash[key];
    pathLatencyValues.values.push(latencyNum || 0);
    pathLatencyValues.total += latencyNum || 0;

    if (!(~~pathLatencyValues.total == pathLatencyValues.total)) {
      pathLatencyValues.total = parseFloat(pathLatencyValues.total.toFixed(2));
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
