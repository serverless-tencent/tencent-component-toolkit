export interface MetricsDataX {
  type: string;
  values?: number[] | string[];
}

export interface MetricsDataY {
  name: string;
  type: string;
  values: number[];
  total: number;
  color?: string;
}

export interface MetricsItem {
  color?: string;
  title: string;
  type: string;
  x?: MetricsDataX;
  y?: MetricsDataY[];
}

export interface MetricsGroup {
  // FIXME: rangeStart 和 startTime 是否重复
  rangeStart?: string;
  rangeEnd?: string;
  startTime?: string;
  endTime?: string;
  metrics: MetricsItem[];
}

export interface MetricsData {
  AttributeName: string;
  Values: { Timestamp: number; Value: number }[];
}

export interface MetricsResponseData {
  Error: never;
  StartTime: string;
  EndTime: string;
  DataPoints: { Timestamps: number[]; Values: number[] }[];
  MetricName: string;
  Period: number;
  Data: MetricsData[];
}

export interface MetricsResponse {
  Response: MetricsResponseData;
}

export type MetricsResponseList = Array<MetricsResponse>;
