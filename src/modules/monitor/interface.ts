export interface GetMonitorDataInputs {
  // 指标名称，参考云函数监控指标文档：https://cloud.tencent.com/document/product/248/45130
  metric: string;
  // 函数名称
  functionName: string;
  // 命名空间
  namespace?: string;
  // 别名，默认流量，$LATEST
  alias?: string;
  // 时间间隔，单位秒，默认为 900s
  interval?: number;
  // 统计周期，单位秒，默认为 60s
  period?: number;
  // 开始时间, 格式：2018-09-22T19:51:23+08:00
  startTime?: string;
  // 结束时间, 格式：2018-09-22T19:51:23+08:00
  endTime?: string;
}
