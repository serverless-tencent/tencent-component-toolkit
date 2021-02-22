declare module 'tencent-cloud-sdk' {
  import { CapiCredentials } from '../src/modules/interface';
  import { RegionType } from './../src/modules/interface';
  import { MetricsResponseList } from './../src/modules/metrics/interface';

  declare class slsMonitor {
    constructor(crendentials: CapiCredentials);
    getScfMetrics: (
      region: RegionType,
      rangeTime: { rangeStart: string; rangeEnd: string },
      period: number,
      funcName: string,
      namespace: string,
      version: string,
    ) => Promise<MetricsResponseList>;
    getApigwMetrics: (
      region: RegionType,
      rangeTime: { rangeStart: string; rangeEnd: string },
      period: number,
      serviceId: string,
      env: string,
    ) => Promise<MetricsResponseList>;
    getCustomMetrics: (
      region: RegionType,
      instances: string[],
      rangeTime: { rangeStart: string; rangeEnd: string },
      period: number,
    ) => Promise<MetricsResponseList>;
  }
}
