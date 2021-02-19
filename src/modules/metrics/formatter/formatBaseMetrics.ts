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
    x: {
      type: 'timestamp',
      values: [],
    },
    y: [],
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
  const latencyContentList = latencyNameList.map((name: string) => {
    return (
      filterMetricByName(`Duration-${name}`, resList) ?? filterMetricByName('Duration', resList)
    );
  });

  for (const latencyContent of latencyContentList) {
    if (latencyContent && latencyContent.DataPoints[0].Timestamps.length > 0) {
      latencyMetricItem.x = {
        type: 'timestamp',
      };
      if (!latencyMetricItem.y) {
        latencyMetricItem.y = [];
      }

      metricGroup.rangeStart = latencyContent.StartTime;
      metricGroup.rangeEnd = latencyContent.EndTime;
      latencyMetricItem.x.values = latencyContent.DataPoints[0].Timestamps.map(
        (ts: number) => ts * 1000,
      );

      const p95 = {
        name: 'p95 latency', // constant
        type: 'duration', // constant
        total: Math.max(...latencyContent.DataPoints[0].Values),
        values: latencyContent.DataPoints[0].Values,
      };
      if (!(~~p95.total == p95.total)) {
        p95.total = parseFloat(p95.total.toFixed(2));
      }
      latencyMetricItem.y.push(p95);
    }
  }

  if (
    latencyContentList.every(
      (latencyContent) => !latencyContent || latencyContent.DataPoints[0].Timestamps.length == 0,
    )
  ) {
    latencyMetricItem.type = 'empty';
  }

  metricGroup.metrics.push(latencyMetricItem);
  return metricGroup;
}

/** 格式化云函数统计信息 */
export function formatBaseMetrics(datas: MetricsResponseList) {
  const metricGroup: MetricsGroup = {
    rangeStart: datas[0].Response.StartTime,
    rangeEnd: datas[0].Response.EndTime,
    metrics: [],
  };
  {
    const res = formatInvocationAndErrorMetrics(datas);
    metricGroup.metrics.push(res.metrics[0]);
    if (res.startTime) {
      metricGroup.startTime = res.startTime;
      metricGroup.endTime = res.endTime;
    }
  }
  {
    const res = formatLatencyMetrics(datas);
    metricGroup.metrics.push(res.metrics[0]);
    if (res.startTime) {
      metricGroup.startTime = res.startTime;
      metricGroup.endTime = res.endTime;
    }
  }
  return metricGroup;
}
