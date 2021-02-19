import { MetricsResponseList, MetricsGroup } from './../interface';
import moment from 'moment';
import { MetricsItem } from '../interface';

/** 格式化 API 网关请求信息 */
export function formatApigwMetrics(resList: MetricsResponseList) {
  const metricGroup: MetricsGroup = {
    metrics: [],
  };

  for (let i = 0; i < resList.length; i++) {
    const metric = resList[i].Response;
    if (metric.Error) {
      continue;
    }
    metricGroup.startTime = metric.StartTime;
    metricGroup.endTime = metric.EndTime;

    let type = 'count';
    const metricItem: MetricsItem = {
      title: '',
      type: 'stacked-bar',
      x: {
        type: 'timestamp',
        values: metric.DataPoints[0].Timestamps.map((ts: number) => ts * 1000),
      },
      y: [],
    };

    let name = '';
    switch (metric.MetricName) {
      case 'NumOfReq':
        name = 'request';
        metricItem.title = 'apigw total request num';
        break;
      case 'ResponseTime':
        name = 'response time';
        type = 'duration';
        metricItem.title = 'apigw request response time(ms)';
        break;
    }

    const item = {
      name: name,
      type: type,
      values: metric.DataPoints[0].Values,
      total: metric.DataPoints[0].Values.reduce((pre: number, cur: number) => {
        return pre + cur;
      }, 0),
    };

    if (!(~~item.total == item.total)) {
      item.total = parseFloat(item.total.toFixed(2));
    }

    if (metricItem?.x?.values?.length == 0) {
      const startTime = moment(metricGroup.startTime);
      const endTime = moment(metricGroup.endTime);

      let n = 0;
      while (startTime <= endTime) {
        metricItem.x.values[n] = startTime.unix() * 1000;
        item.values[n] = 0;
        n++;
        startTime.add(metric.Period, 's');
      }

      item.total = 0;
    }

    metricItem?.y?.push(item);
    if (metricItem) {
      metricGroup.metrics.push(metricItem);
    }
  }

  return metricGroup;
}
