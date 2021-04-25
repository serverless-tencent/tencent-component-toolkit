import { Capi } from '@tencent-sdk/capi';
// import { waitResponse } from '@ygkit/request';
// import { ApiError } from '../../utils/error';
import { ApiServiceType } from '../interface';
import { GetMonitorDataInputs } from './interface';
import APIS, { ActionType } from './apis';
import { pascalCaseProps } from '../../utils/index';
import { dtz, formatDate } from '../../utils/dayjs';
import { CapiCredentials, RegionType } from '../interface';

export default class Monitor {
  credentials: CapiCredentials;
  capi: Capi;
  region: RegionType;

  constructor(credentials: CapiCredentials, region: RegionType = 'ap-guangzhou') {
    this.credentials = credentials;
    this.region = region;

    this.capi = new Capi({
      Region: region,
      ServiceType: ApiServiceType.monitor,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });
  }

  async get(inputs: GetMonitorDataInputs) {
    const {
      metric,
      functionName,
      namespace = 'default',
      alias,
      period = 60,
      interval = 900,
      startTime,
      endTime = Date.now(),
    } = inputs;

    const endDate = dtz(endTime);
    const startDate = startTime ? dtz(startTime) : endDate.add(0 - interval, 'second');
    const formatedStartTime = formatDate(startDate, true);
    const formatedEndTime = formatDate(endDate, true);

    const dimensions = [
      {
        Name: 'namespace',
        Value: namespace,
      },
      {
        Name: 'functionName',
        Value: functionName,
      },
    ];

    if (alias) {
      dimensions.push({
        Name: 'alias',
        Value: alias,
      });
    }

    const res = await this.request({
      MetricName: metric,
      Action: 'GetMonitorData',
      Namespace: 'QCE/SCF_V2',
      Instances: [
        {
          Dimensions: dimensions,
        },
      ],
      Period: period,
      StartTime: formatedStartTime,
      EndTime: formatedEndTime,
    });

    return res;
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, pascalCaseProps(data));
    return result;
  }
}
