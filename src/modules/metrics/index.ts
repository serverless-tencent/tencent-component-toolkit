import { CapiCredentials, RegionType } from '../interface';
import assert from 'assert';
import moment from 'moment';
import util from 'util';
import { ApiTypeError, ApiError } from '../../utils/error';
import { MetricsGroup } from './interface';
import { formatApigwMetrics, formatBaseMetrics, formatCustomMetrics } from './formatter';
import { slsMonitor as SlsMonitor } from 'tencent-cloud-sdk';

export default class Metrics {
  funcName: string;
  namespace: string;
  version: string;
  apigwServiceId?: string;
  apigwEnvironment?: string;

  region: RegionType;
  credentials: CapiCredentials;

  slsClient: SlsMonitor;
  timezone: string;

  constructor(
    credentials: CapiCredentials = {},
    options: {
      region?: RegionType;
      funcName?: string;
      namespace?: string;
      version?: string;
      apigwServiceId?: string;
      apigwEnvironment?: string;
      timezone?: string;
    } = {},
  ) {
    this.region = options.region || 'ap-guangzhou';
    this.credentials = credentials;
    assert(options.funcName, 'function name should not is empty');
    this.funcName = options.funcName;
    this.namespace = options.namespace || 'default';
    this.version = options.version || '$LATEST';
    this.apigwServiceId = options.apigwServiceId;
    this.apigwEnvironment = options.apigwEnvironment;

    this.slsClient = new SlsMonitor(this.credentials);
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

  async scfMetrics(startTime: string, endTime: string, period: number): Promise<never> {
    const rangeTime = {
      rangeStart: startTime,
      rangeEnd: endTime,
    };
    try {
      const responses = await this.slsClient.getScfMetrics(
        this.region,
        rangeTime,
        period,
        this.funcName,
        this.namespace,
        this.version,
      );
      return responses as never;
    } catch (e) {
      throw new ApiError({
        type: 'API_METRICS_getScfMetrics',
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  async apigwMetrics(
    startTime: string,
    endTime: string,
    period: number,
    serviceId: string,
    env: string,
  ) {
    const rangeTime = {
      rangeStart: startTime,
      rangeEnd: endTime,
    };

    try {
      const responses = await this.slsClient.getApigwMetrics(
        this.region,
        rangeTime,
        period,
        serviceId,
        env,
      );
      return responses;
    } catch (e) {
      throw new ApiError({
        type: 'API_METRICS_getApigwMetrics',
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  async customMetrics(startTime: string, endTime: string, period: number) {
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
      const responses = await this.slsClient.getCustomMetrics(
        this.region,
        instances,
        rangeTime,
        period,
      );
      return responses as never;
    } catch (e) {
      throw new ApiError({
        type: 'API_METRICS_getCustomMetrics',
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  // eslint-disable-next-line no-undef
  async getDatas(startTimeStr: string, endTimeStr: string, metricsType = Metrics.Type.All) {
    const startTime = moment(startTimeStr);
    const endTime = moment(endTimeStr);

    if (endTime <= startTime) {
      throw new ApiTypeError(`PARAMETER_METRICS`, 'The rangeStart provided is after the rangeEnd');
    }

    if (startTime.isAfter(endTime)) {
      throw new ApiTypeError(`PARAMETER_METRICS`, 'The rangeStart provided is after the rangeEnd');
    }

    // custom metrics maximum 8 day
    if (startTime.diff(endTime, 'days') >= 8) {
      throw new ApiTypeError(
        `PARAMETER_METRICS`,
        `The range cannot be longer than 8 days.  The supplied range is: ${startTime.diff(
          endTime,
          'days',
        )}`,
      );
    }

    let period: number;
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

    let response: MetricsGroup = {
      rangeStart: startTime.format('YYYY-MM-DD HH:mm:ss'),
      rangeEnd: endTime.format('YYYY-MM-DD HH:mm:ss'),
      metrics: [],
    };

    if (metricsType & Metrics.Type.Base) {
      const timeFormat = 'YYYY-MM-DDTHH:mm:ss' + this.timezone;
      const results = await this.scfMetrics(
        startTime.format(timeFormat),
        endTime.format(timeFormat),
        period,
      );
      response = formatBaseMetrics(results);
    }

    if (metricsType & Metrics.Type.Custom) {
      const data = await this.customMetrics(
        startTime.format('YYYY-MM-DD HH:mm:ss'),
        endTime.format('YYYY-MM-DD HH:mm:ss'),
        period,
      );
      const results = formatCustomMetrics(data);
      response.metrics = response.metrics.concat(results ?? []);
    }

    if (metricsType & Metrics.Type.Apigw) {
      const data = await this.apigwMetrics(
        startTime.format('YYYY-MM-DD HH:mm:ss'),
        endTime.format('YYYY-MM-DD HH:mm:ss'),
        period,
        this.apigwServiceId!,
        this.apigwEnvironment!,
      );

      const results = formatApigwMetrics(data);
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
}
