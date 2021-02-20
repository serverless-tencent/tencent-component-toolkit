import { MetricsGroup } from './../interface';
import { MetricsItem, MetricsResponseList } from '../interface';
import { filterMetricByName } from '../utils';

/** 格式化云函数请求和错误统计信息 */
export function formatInvocationAndErrorMetrics(resList: MetricsResponseList) {
  const metricGroup: MetricsGroup = {
    metrics: [],
  };

  const invocationAndErrorMetricItem: MetricsItem = {
    type: 'stacked-bar',
    title: 'function invocations & errors',
  };

  const invocations = filterMetricByName('Invocation', resList);
  if (invocations && invocations.DataPoints[0].Timestamps.length > 0) {
    invocationAndErrorMetricItem.x = {
      type: 'timestamp',
      values: [],
    };
    if (!invocationAndErrorMetricItem.y) {
      invocationAndErrorMetricItem.y = [];
    }

    metricGroup.rangeStart = invocations.StartTime;
    metricGroup.rangeEnd = invocations.EndTime;

    invocationAndErrorMetricItem.x.values = invocations.DataPoints[0].Timestamps.map(
      (ts: number) => ts * 1000,
    );

    const funcInvItem = {
      name: invocations.MetricName.toLocaleLowerCase(),
      type: 'count',
      total: invocations.DataPoints[0].Values.reduce(function (a: number, b: number) {
        return a + b;
      }, 0),
      values: invocations.DataPoints[0].Values,
    };
    invocationAndErrorMetricItem.y.push(funcInvItem);
  }

  const errors = filterMetricByName('Error', resList);
  if (errors && errors.DataPoints[0].Timestamps.length > 0) {
    invocationAndErrorMetricItem.x = {
      type: 'timestamp',
      values: errors.DataPoints[0].Timestamps.map((ts: number) => ts * 1000),
    };
    if (!invocationAndErrorMetricItem.y) {
      invocationAndErrorMetricItem.y = [];
    }

    metricGroup.rangeStart = errors.StartTime;
    metricGroup.rangeEnd = errors.EndTime;
    const funcErrItem = {
      name: errors.MetricName.toLocaleLowerCase(),
      type: 'count',
      color: 'error',
      total: errors.DataPoints[0].Values.reduce(function (a: number, b: number) {
        return a + b;
      }, 0),
      values: errors.DataPoints[0].Values,
    };
    invocationAndErrorMetricItem.y.push(funcErrItem);
  }

  if (
    (!invocations || invocations.DataPoints[0].Timestamps.length == 0) &&
    (!errors || errors.DataPoints[0].Timestamps.length == 0)
  ) {
    invocationAndErrorMetricItem.type = 'empty';
  }

  metricGroup.metrics.push(invocationAndErrorMetricItem);
  return metricGroup;
}

/** 格式化云函数时延（运行时间）统计信息 */
export function formatLatencyMetrics(resList: MetricsResponseList) {
  const metricGroup: MetricsGroup = {
    metrics: [],
  };

  const latencyMetricItem: MetricsItem = {
    type: 'multiline', // constant
    title: 'function latency', // constant
  };
  const latencyNameList = ['P50', 'P95'];
  const latencyDetailList = latencyNameList.map((name: string) => {
    return {
      name,
      data:
        filterMetricByName(`Duration-${name}`, resList) ?? filterMetricByName('Duration', resList),
    };
  });

  for (const detail of latencyDetailList) {
    if (detail.data && detail.data.DataPoints[0].Timestamps.length > 0) {
      latencyMetricItem.x = {
        type: 'timestamp',
      };
      if (!latencyMetricItem.y) {
        latencyMetricItem.y = [];
      }

      metricGroup.rangeStart = detail.data.StartTime;
      metricGroup.rangeEnd = detail.data.EndTime;
      latencyMetricItem.x.values = detail.data.DataPoints[0].Timestamps.map(
        (ts: number) => ts * 1000,
      );

      const y = {
        name: `${detail.name} latency`, // constant
        type: 'duration', // constant
        total: Math.max(...detail.data.DataPoints[0].Values),
        values: detail.data.DataPoints[0].Values,
      };
      if (!(~~y.total == y.total)) {
        y.total = parseFloat(y.total.toFixed(2));
      }
      latencyMetricItem.y.push(y);
    }
  }

  if (latencyDetailList.every((d) => !d.data || d.data.DataPoints[0].Timestamps.length === 0)) {
    latencyMetricItem.type = 'empty';
  }

  metricGroup.metrics.push(latencyMetricItem);
  return metricGroup;
}

/** 格式化云函数统计信息 */
export function formatBaseMetrics(datas: MetricsResponseList) {
  const metrics: MetricsItem[] = [];
  {
    const res = formatInvocationAndErrorMetrics(datas);
    metrics.push(res.metrics[0]);
  }
  {
    const res = formatLatencyMetrics(datas);
    metrics.push(res.metrics[0]);
  }
  return metrics;
}
