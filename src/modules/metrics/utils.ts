import url from 'url';

interface MetricA {
  MetricName: string;
  DataPoints: { Values: number[]; Timestamps: number[] }[];
  StartTime: string;
  EndTime: string;
}

export interface MetricB {
  color?: string;
  title: string;
  type: string;
  x?: MetricX;
  y?: MetricY[];
}

export interface MetricX {
  type: string;
  values?: number[];
}

export interface MetricY {
  name: string;
  type: string;
  values: any;
  total: any;
}

export function filterMetricByNameExp(
  metricName: string | RegExp,
  metrics: {
    Response: {
      Error: string;
      Data: { AttributeName: string; Values: { Value: number; Timestamp: number }[] }[];
    };
  }[],
  all?: any,
) {
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
}
export function filterMetricByName(metricName: string, metrics: { Response: MetricA }[]) {
  const len = metrics.length;

  for (var i = 0; i < len; i++) {
    if (metrics[i].Response.MetricName == metricName) {
      return metrics[i].Response;
    }
  }
  return null;
}

export function hex2path(hexPath: string): string {
  const len = hexPath.length;
  let path = '';
  for (let i = 0; i < len; ) {
    const char = hexPath.slice(i, i + 2);
    if (isNaN(parseInt(char, 16))) {
      return '';
    }
    path += String.fromCharCode(parseInt(char, 16));
    i += 2;
  }
  return path.toLocaleLowerCase();
}

export function parsePath(m: RegExp, path: string) {
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
}

export function makeMetric(
  name: string,
  metricData: { Values: { Value: number; Timestamp: number }[] },
) {
  const data = {
    name: name,
    type: 'duration',
    values: metricData.Values.map((item) => {
      return item.Value;
    }),
    total: 0,
    color: '',
  };

  data.total = data.values.reduce(function (a: number, b: number) {
    return a + b;
  }, 0);

  if (!(~~data.total == data.total)) {
    data.total = parseFloat(data.total.toFixed(2));
  }
  return data;
}

export function parseErrorPath(m: string | RegExp, path: string) {
  const ret = path.match(m);
  if (!ret) {
    return null;
  }

  const method = ret[1];
  const hexPath = ret[2];
  const code = parseInt(ret[3], 10);

  const pathObj = url.parse(hex2path(hexPath)!);

  return {
    method: method.toLocaleUpperCase(),
    path: pathObj ? pathObj.pathname : hex2path(hexPath),
    code: code,
  };
}
