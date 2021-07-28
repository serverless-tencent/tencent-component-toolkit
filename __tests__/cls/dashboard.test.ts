import { DeployDashboardInputs } from '../../src/modules/cls/interface';
import { Cls } from '../../src';

// TODO: 添加更多的图形测试用例，目前 CLS 产品并未相关说明文档
describe('Cls dashboard', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const clsConfig = {
    logsetId: '5681feab-fae1-4a50-b41b-fb93d565d1fc',
    topicId: 'c429f9ca-8229-4cef-9d63-dd9ad6189f4c',
  };
  // * | select SCF_StartTime as time, max(SCF_MemUsage) / 1000000 as memory group by SCF_StartTime
  const chart1Config = {
    id: 'chart-d0a90626-0a73-466c-8a94-2f5bdc597abd',
    title: 'Request URL Time',
    type: 'bar',
    query: '* | select url,request_time',
    yAxis: 'request_time',
    yAxisUnit: 'ms',
    aggregateKey: 'url',
  };
  const chart2Config = {
    id: 'chart-ed7a85c7-5327-4763-93c0-b137be676258',
    title: '4xx Code',
    type: 'bar',
    query:
      '* | select error_code, count(*) as count where error_code > 400 and error_code < 500 group by error_code',
    yAxis: 'count',
    yAxisUnit: '',
    aggregateKey: 'error_code',
  };
  const client = new Cls(credentials, process.env.REGION);

  const inputs: DeployDashboardInputs = {
    name: 'serverless-unit-test',
    data: JSON.stringify({
      panels: [
        {
          id: chart1Config.id,
          title: chart1Config.title,
          description: null,
          gridPos: { x: 0, y: 0, w: 12, h: 8 },
          type: chart1Config.type,
          target: {
            RegionId: 1,
            LogsetId: clsConfig.logsetId,
            TopicId: clsConfig.topicId,
            Query: chart1Config.query,
            ChartAxis: {
              xAxisKey: '',
              yAxisKeys: [chart1Config.yAxis],
              aggregateKey: chart1Config.aggregateKey,
            },
          },
          chartConfig: {
            orientation: true,
            unit: chart1Config.yAxisUnit,
            options: { dataLinks: [] },
            legend: { show: false },
            xAxis: { position: 'bottom', axisLabel: {} },
            yAxis: { position: 'top' },
            type: 'basicBar',
            staticStyle: 'current',
            sort: -1,
            decimals: null,
            id: chart1Config.id,
          },
          fieldConfig: { defaults: {}, overrides: [] },
        },
        {
          id: chart2Config.id,
          title: chart2Config.title,
          description: null,
          gridPos: { x: 0, y: 0, w: 12, h: 8 },
          type: chart2Config.type,
          target: {
            RegionId: 1,
            LogsetId: clsConfig.logsetId,
            TopicId: clsConfig.topicId,
            Query: chart2Config.query,
            ChartAxis: {
              xAxisKey: '',
              yAxisKeys: [chart2Config.yAxis],
              aggregateKey: chart2Config.aggregateKey,
            },
          },
          chartConfig: {
            orientation: true,
            unit: chart2Config.yAxisUnit,
            options: { dataLinks: [] },
            legend: { show: false },
            xAxis: { position: 'bottom', axisLabel: {} },
            yAxis: { position: 'top' },
            type: 'basicBar',
            staticStyle: 'current',
            sort: -1,
            decimals: null,
            id: chart2Config.id,
          },
          fieldConfig: { defaults: {}, overrides: [] },
        },
      ],
    }),
  };

  let dashboardId = '';

  test('deploy dashboard', async () => {
    const res = await client.deployDashboard(inputs);
    expect(res).toEqual({
      id: expect.stringContaining('dashboard-'),
      name: inputs.name,
      data: inputs.data,
    });

    dashboardId = res.id;
  });

  test('get dashboard list', async () => {
    const res = await client.getDashboardList();
    expect(res[0]).toEqual({
      createTime: expect.any(String),
      id: expect.stringContaining('dashboard-'),
      name: expect.any(String),
      data: expect.any(String),
    });
  });

  test('get dashboard detail by id', async () => {
    const res = await client.getDashboardDetail({
      id: dashboardId,
    });
    expect(res).toEqual({
      createTime: expect.any(String),
      id: expect.stringContaining('dashboard-'),
      name: expect.any(String),
      data: expect.any(String),
    });
  });

  test('get dashboard detail by name', async () => {
    const res = await client.getDashboardDetail({
      name: inputs.name,
    });
    expect(res).toEqual({
      createTime: expect.any(String),
      id: expect.stringContaining('dashboard-'),
      name: expect.any(String),
      data: expect.any(String),
    });
  });

  test('remove dashboard', async () => {
    const res = await client.removeDashboard(inputs);
    expect(res).toEqual(true);
  });
});
