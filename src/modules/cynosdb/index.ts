import { Capi } from '@tencent-sdk/capi';
import { CapiCredentials, RegionType, ApiServiceType } from '../interface';
import {
  CynosdbDeployInputs,
  CynosdbDeployOutputs,
  CynosdbRemoveInputs,
  CynosdbResetPwdInputs,
} from './interface';
import {
  createCluster,
  getClusterDetail,
  getClusterInstances,
  isolateCluster,
  offlineCluster,
  generatePwd,
  formatConnectOutput,
  resetPwd,
  openPublicAccess,
  closePublicAccess,
} from './utils';
import { ApiError } from '../../utils/error';
import TagClient from '../tag';

export default class Cynosdb {
  credentials: CapiCredentials;
  region: RegionType;
  capi: Capi;
  tagClient: TagClient;

  constructor(credentials: CapiCredentials = {}, region: RegionType = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.cynosdb,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });

    this.tagClient = new TagClient(this.credentials, this.region);
  }

  /** 部署 Cynosdb 实例 */
  async deploy(inputs: CynosdbDeployInputs = {}) {
    const {
      clusterId,
      region,
      zone,
      vpcConfig,
      projectId = 0,
      dbVersion = '5.7',
      dbType = 'MYSQL',
      port = 3306,
      cpu = 1,
      memory = 1,
      storageLimit = 1000,
      instanceCount = 2,
      adminPassword,
      payMode = 0,
      timeSpan = 1,
      timeUnit = 'm',
      autoVoucher = 1,
      dbMode = 'NORMAL',
      minCpu = 0.5,
      maxCpu = 2,
      autoPause = 'yes',
      autoPauseDelay = 3600, // default 1h
      enablePublicAccess,
    } = inputs;

    const outputs: CynosdbDeployOutputs = {
      dbMode,
      region,
      zone,
      vpcConfig,
      instanceCount,
    };

    if (dbMode === 'SERVERLESS') {
      outputs.minCpu = minCpu;
      outputs.maxCpu = maxCpu;
      outputs.instanceCount = 1;
    }

    let isExisted = false;
    let clusterDetail = null;
    if (clusterId) {
      clusterDetail = await getClusterDetail(this.capi, clusterId);
      if (clusterDetail && clusterDetail.ClusterId) {
        isExisted = true;
        outputs.clusterId = clusterDetail.ClusterId;
        if (adminPassword) {
          outputs.adminPassword = adminPassword;
        }
      }
    }
    if (!isExisted) {
      // not exist, create
      const dbInputs: any = {
        Zone: zone,
        ProjectId: projectId,
        DbType: dbType,
        DbVersion: dbVersion,
        Port: port,
        Cpu: cpu,
        Memory: memory,
        StorageLimit: storageLimit,
        InstanceCount: instanceCount,
        PayMode: payMode,
        AutoVoucher: autoVoucher,
        RollbackStrategy: 'noneRollback',
        OrderSource: 'serverless',
        VpcId: vpcConfig?.vpcId,
        SubnetId: vpcConfig?.subnetId,
        AdminPassword: adminPassword ?? generatePwd(),
        DbMode: dbMode,
      };
      // prepay need set timespan 1month
      if (payMode === 1) {
        dbInputs.TimeSpan = timeSpan;
        dbInputs.TimeUnit = timeUnit;
      }

      if (dbMode === 'SERVERLESS') {
        dbInputs.MinCpu = minCpu;
        dbInputs.MaxCpu = maxCpu;
        dbInputs.AutoPause = autoPause;
        dbInputs.AutoPauseDelay = autoPauseDelay;
      }

      clusterDetail = await createCluster(this.capi, dbInputs);
      outputs.clusterId = clusterDetail.ClusterId;

      outputs.adminPassword = dbInputs.AdminPassword;
    } else {
      console.log(`Cynosdb cluster ${outputs.clusterId} already exist`);
    }

    outputs.connection = formatConnectOutput(clusterDetail);

    if (enablePublicAccess) {
      const wanInfo = await openPublicAccess(this.capi, outputs.clusterId!);
      outputs.publicConnection = {
        domain: wanInfo.WanDomain,
        ip: wanInfo.WanIP,
        port: wanInfo.WanPort,
      };
    } else if (enablePublicAccess === false) {
      await closePublicAccess(this.capi, outputs.clusterId!);
    }

    const clusterInstances = await getClusterInstances(this.capi, outputs.clusterId!);
    outputs.instances = clusterInstances?.map((item) => ({
      id: item.InstanceId,
      name: item.InstanceName,
      role: item.InstanceRole,
      type: item.InstanceType,
      status: item.Status,
    }));

    try {
      const { tags } = inputs;
      if (tags) {
        await this.tagClient.deployResourceTags({
          tags: tags.map(({ key, value }) => ({ TagKey: key, TagValue: value })),
          resourceId: outputs.clusterId!,
          serviceType: ApiServiceType.cynosdb,
          resourcePrefix: 'instance',
        });

        if (tags.length > 0) {
          outputs.tags = tags;
        }
      }
    } catch (e) {
      console.log(`[TAG] ${e.message}`);
    }

    return outputs;
  }

  /** 移除 Cynosdb 实例 */
  async remove(inputs: CynosdbRemoveInputs = {}) {
    const { clusterId } = inputs;

    const clusterDetail = await getClusterDetail(this.capi, clusterId!);
    if (clusterDetail && clusterDetail.ClusterId) {
      // need circle for deleting, after host status is 6, then we can delete it
      await isolateCluster(this.capi, clusterId!);
      await offlineCluster(this.capi, clusterId!);
    }
    return true;
  }

  /** 重制 Cynosdb 密码 */
  async resetPwd(inputs: CynosdbResetPwdInputs = {}) {
    const { clusterId } = inputs;

    const clusterDetail = await getClusterDetail(this.capi, clusterId!);
    if (clusterDetail && clusterDetail.ClusterId) {
      // need circle for deleting, after host status is 6, then we can delete it
      await resetPwd(this.capi, inputs);
    } else {
      throw new ApiError({
        type: 'PARAMETER_CYNOSDB',
        message: `CynosDB cluster id: ${clusterId} not exist.`,
      });
    }
    return true;
  }
}
