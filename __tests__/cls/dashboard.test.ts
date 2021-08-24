import { Cls } from '../../src';
import {
  DashboardChartType,
  DeployDashboardInputs,
  DeployDashChartInputs,
} from '../../src/modules/cls/dashboard';

// TODO: 添加更多的图形测试用例，目前 CLS 产品并未相关说明文档
describe('Cls dashboard', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const logsetConfig = {
    region: process.env.REGION,
    logsetId: '5681feab-fae1-4a50-b41b-fb93d565d1fc',
    topicId: 'c429f9ca-8229-4cef-9d63-dd9ad6189f4c',
  };
  // * | select SCF_StartTime as time, max(SCF_MemUsage) / 1000000 as memory group by SCF_StartTime
  const chart1Config: DeployDashChartInputs = {
    title: 'Request URL Time',
    type: 'bar' as DashboardChartType,
    query: '* | select url,request_time',
    yAxisKey: 'request_time',
    aggregateKey: 'url',
  };
  const chart2Config: DeployDashChartInputs = {
    title: '4xx Code',
    type: 'bar' as DashboardChartType,
    query:
      '* | select error_code, count(*) as count where error_code > 400 and error_code < 500 group by error_code',
    yAxisKey: 'count',
    aggregateKey: 'error_code',
  };
  const cls = new Cls(credentials, process.env.REGION);

  const inputs: DeployDashboardInputs = {
    name: 'serverless-unit-test-dashboard',
    charts: [chart1Config, chart2Config],
  };

  let dashboardId = '';

  test('deploy dashboard', async () => {
    const res = await cls.dashboard.deploy(inputs, logsetConfig);
    expect(res).toEqual({
      id: expect.stringContaining('dashboard-'),
      name: inputs.name,
      charts: expect.any(Array),
    });

    dashboardId = res.id;

    console.log({ dashboardId });
  });

  test('get dashboard list', async () => {
    const res = await cls.dashboard.getList();
    expect(res[0]).toEqual({
      createTime: expect.any(String),
      id: expect.stringContaining('dashboard-'),
      name: expect.any(String),
      charts: expect.any(Array),
    });
  });

  test('get dashboard detail by id', async () => {
    console.log({ dashboardId });
    const res = await cls.dashboard.getDetail({
      id: dashboardId,
    });
    expect(res).toEqual({
      id: expect.stringContaining('dashboard-'),
      name: expect.any(String),
      createTime: expect.any(String),
      charts: expect.any(Array),
    });
  });

  test('get dashboard detail by name', async () => {
    const res = await cls.dashboard.getDetail({
      name: inputs.name,
    });
    expect(res).toEqual({
      createTime: expect.any(String),
      id: expect.stringContaining('dashboard-'),
      name: expect.any(String),
      charts: expect.any(Array),
    });
  });

  test('remove dashboard', async () => {
    const res = await cls.dashboard.remove(inputs);
    expect(res).toEqual(true);
  });
});
