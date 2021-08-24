import ReactGridLayout from 'react-grid-layout';
import Cls from '.';
import * as uuid from 'uuid';
import { ApiError } from '../../utils/error';

export interface RemoveDashboardInputs {
  name?: string;
  id?: string;
}

export enum DashboardChartType {
  table = 'table',
  graph = 'graph',
  bar = 'bar',
  stat = 'stat',
  gauge = 'gauge',
  pie = 'pie',

  sankey = 'sankey',
  map = 'map',
  tMap = 'tMap', // 未启用

  row = 'row',
  'add-panel' = 'add-panel',
}

export namespace Raw {
  export const regionId2Name: Record<number, string> = {
    1: 'ap-guangzhou',
    4: 'ap-shanghai',
    5: 'ap-hongkong',
    6: 'na-toronto',
    7: 'ap-shanghai-fsi',
    8: 'ap-beijing',
    9: 'ap-singapore',
    11: 'ap-shenzhen-fsi',
    12: 'ap-guangzhou-open',
    15: 'na-siliconvalley',
    16: 'ap-chengdu',
    17: 'eu-frankfurt',
    18: 'ap-seoul',
    19: 'ap-chongqing',
    21: 'ap-mumbai',
    22: 'na-ashburn',
    23: 'ap-bangkok',
    24: 'eu-moscow',
    25: 'ap-tokyo',
    31: 'ap-jinan-ec',
    32: 'ap-hangzhou-ec',
    33: 'ap-nanjing',
    34: 'ap-fuzhou-ec',
    35: 'ap-wuhan-ec',
    36: 'ap-tianjin',
    37: 'ap-shenzhen',
    39: 'ap-taipei',
    45: 'ap-changsha-ec',
    46: 'ap-beijing-fsi',
    53: 'ap-shijiazhuang-ec',
    54: 'ap-qingyuan',
    55: 'ap-hefei-ec',
    56: 'ap-shenyang-ec',
    57: 'ap-xian-ec',
    58: 'ap-xibei-ec',
    71: 'ap-zhengzhou-ec',
    72: 'ap-jakarta',
    73: 'ap-qingyuan-xinan',
    74: 'sa-saopaulo',
  };
  export const regionName2Id: Record<string, number> = {
    'ap-guangzhou': 1,
    'ap-shanghai': 4,
    'ap-hongkong': 5,
    'na-toronto': 6,
    'ap-shanghai-fsi': 7,
    'ap-beijing': 8,
    'ap-singapore': 9,
    'ap-shenzhen-fsi': 11,
    'ap-guangzhou-open': 12,
    'na-siliconvalley': 15,
    'ap-chengdu': 16,
    'eu-frankfurt': 17,
    'ap-seoul': 18,
    'ap-chongqing': 19,
    'ap-mumbai': 21,
    'na-ashburn': 22,
    'ap-bangkok': 23,
    'eu-moscow': 24,
    'ap-tokyo': 25,
    'ap-jinan-ec': 31,
    'ap-hangzhou-ec': 32,
    'ap-nanjing': 33,
    'ap-fuzhou-ec': 34,
    'ap-wuhan-ec': 35,
    'ap-tianjin': 36,
    'ap-shenzhen': 37,
    'ap-taipei': 39,
    'ap-changsha-ec': 45,
    'ap-beijing-fsi': 46,
    'ap-shijiazhuang-ec': 53,
    'ap-qingyuan': 54,
    'ap-hefei-ec': 55,
    'ap-shenyang-ec': 56,
    'ap-xian-ec': 57,
    'ap-xibei-ec': 58,
    'ap-zhengzhou-ec': 71,
    'ap-jakarta': 72,
    'ap-qingyuan-xinan': 73,
    'sa-saopaulo': 74,
  };

  export interface DashboardChartTarget {
    RegionId: number;
    LogsetId: string;
    TopicId: string;
    Query: string;
    /** 图表数据处理参数 */
    ChartAxis?: {
      xAxisKey?: string;
      yAxisKey?: string;
      aggregateKey?: string;
    };
  }

  type FieldConfigSource = unknown;

  export interface DashboardChart {
    id: string;
    title: string;
    description?: string;
    gridPos: Partial<ReactGridLayout.Layout>;
    /** 图表类型 */
    type: DashboardChartType;
    /** 数据请求涉及参数 */
    target: DashboardChartTarget;
    /**
     * 图表配置，和图表的类型有关，每个图表类型都有独立的配置
     */
    options?: unknown;

    chartConfig?: unknown;
    /**
     * filed配置，包含默认配置和针对某个filed的override情况，对数值的处理、特殊显示、link、mappings都属于此类
     * 和具体的图表类型无关，配置修改的是dataFrame本身
     */
    fieldConfig?: FieldConfigSource;
  }

  // 云 API 返回的 dashboard 结构
  export interface Dashboard {
    CreateTime: string;
    DashboardId: string;
    DashboardName: string;
    data: string;
  }
}

export interface LogsetConfig {
  region: string;
  logsetId: string;
  topicId: string;
}

export interface DashboardChart {
  id: string;
  title: string;
  description?: string;
  type: DashboardChartType;
  query: string;

  xAxisKey?: string;
  yAxisKey?: string;

  aggregateKey?: string;
}

export type DeployDashChartInputs = Omit<DashboardChart, 'id'>;

export interface DeployDashboardInputs {
  name: string;
  charts: DeployDashChartInputs[];
}

// camelCase 的 dashboard 结构，并作了简化
export interface Dashboard {
  createTime: string;
  id: string;
  name: string;
  charts: DashboardChart[];
}

export class ClsDashboard {
  cls: Cls;
  constructor(cls: Cls) {
    this.cls = cls;
  }

  // 获取 dashboard 列表
  async getList(): Promise<Dashboard[]> {
    console.log(`Getting dashboard list`);
    const res = await this.cls.clsClient.request({
      method: 'GET',
      path: '/dashboards',
    });
    if (res.error) {
      throw new ApiError({
        type: 'API_getDashboard',
        message: res.error.message,
      });
    }
    const dashboards = ((res.dashboards || []) as Raw.Dashboard[]).map(
      ({ CreateTime, DashboardName, DashboardId, data }: Raw.Dashboard) => {
        let parseData = [];
        try {
          parseData = JSON.parse(data);
        } catch (err) {
          console.log(`Get list fail id: ${DashboardId}, data: ${data}`);
        }
        const dashboard: Dashboard = {
          createTime: CreateTime,
          name: DashboardName,
          id: DashboardId,
          charts: parseData.panels,
        };

        return dashboard;
      },
    );

    return dashboards;
  }

  // 获取 dashboard 详情
  async getDetail({ name, id }: { name?: string; id?: string }): Promise<Dashboard | undefined> {
    console.log(`Getting dashboard id: ${id}, name: ${name}`);
    if (id) {
      const res = await this.cls.clsClient.request({
        method: 'GET',
        path: `/dashboard`,
        query: {
          DashboardId: id,
        },
      });
      if (res.error) {
        return undefined;
      }

      let parseData = [];
      try {
        parseData = JSON.parse(res.data);
      } catch (err) {
        console.log(`Get detail failed: ${id}, data: ${res.data}`);
      }
      const rawPanels: Raw.DashboardChart[] = parseData.panels;

      return {
        id,
        createTime: res.CreateTime,
        name: res.DashboardName,
        charts: rawPanels.map((v) => ({
          id: v.id,
          title: v.title,
          description: v.description,
          type: v.type,
          query: v.target.Query,
          xAxisKey: v.target.ChartAxis?.xAxisKey,
          yAxisKey: v.target.ChartAxis?.yAxisKey,
          aggregateKey: v.target.ChartAxis?.aggregateKey,
        })),
      };
    }
    if (name) {
      const list = await this.getList();
      const exist = list.find((item) => item.name === name);
      if (exist) {
        return exist;
      }
      return undefined;
    }
    throw new ApiError({
      type: 'API_getDashboardDetail',
      message: 'name or id is required',
    });
  }

  // 删除 dashboard
  async remove({ id, name }: RemoveDashboardInputs) {
    console.log(`Removing dashboard id: ${id}, name: ${name}`);
    if (!id && !name) {
      throw new ApiError({
        type: 'API_removeDashboard',
        message: 'id or name is required',
      });
    }
    if (!id) {
      // 通过名称查找ID
      const exist = await this.getDetail({ name });
      if (!exist) {
        console.log(`Dashboard ${name} not exist`);

        return true;
      }
      ({ id } = exist);
    }
    // 删除 dashboard
    const res = await this.cls.clsClient.request({
      method: 'DELETE',
      path: `/dashboard`,
      query: {
        DashboardId: id,
      },
    });

    if (res.error) {
      throw new ApiError({
        type: 'API_deleteDashboard',
        message: res.error.message,
      });
    }

    return true;
  }

  // 创建 dashboard
  async deploy(inputs: DeployDashboardInputs, logsetConfig: LogsetConfig) {
    console.log(`Deploy dashboard ${inputs.name}`);
    const { name, charts } = inputs;
    const data = JSON.stringify({
      panels: charts.map((v) => {
        const panel: Raw.DashboardChart = {
          id: 'chart-' + uuid.v4(),
          title: v.title,
          gridPos: { x: 0, y: 0, w: 12, h: 8 },
          description: v.description,
          type: v.type,
          target: {
            RegionId: Raw.regionName2Id[logsetConfig.region],
            LogsetId: logsetConfig.logsetId,
            TopicId: logsetConfig.topicId,
            Query: v.query,
            ChartAxis: {
              xAxisKey: v.xAxisKey,
              yAxisKey: v.yAxisKey,
              aggregateKey: v.aggregateKey,
            },
          },
        };
        return panel;
      }),
    });

    // 1. 检查是否存在同名 dashboard
    const exist = await this.getDetail({ name });
    let dashboardId = '';
    // 2. 如果不存在则创建，否则更新
    if (exist) {
      dashboardId = exist.id;
      const res = await this.cls.clsClient.request({
        method: 'PUT',
        path: '/dashboard',
        data: {
          DashboardId: exist.id,
          DashboardName: name,
          data,
        },
      });
      if (res.error) {
        throw new ApiError({
          type: 'API_updateDashboard',
          message: res.error.message,
        });
      }
    } else {
      const res = await this.cls.clsClient.request({
        method: 'POST',
        path: '/dashboard',
        data: {
          DashboardName: name,
          data,
        },
      });
      if (res.error) {
        throw new ApiError({
          type: 'API_createDashboard',
          message: res.error.message,
        });
      }
      dashboardId = res.DashboardId;
    }

    return {
      id: dashboardId,
      name,
      charts: inputs.charts,
    };
  }
}
