import { RegionType } from './../interface';
import { ScfCreateFunctionInputs } from './interface';
const CONFIGS = require('./config').default;

// get function basement configure
// FIXME: unused variable region
export const formatFunctionInputs = (region: RegionType, inputs: ScfCreateFunctionInputs) => {
  const functionInputs: {
    FunctionName?: string;
    CodeSource?: 'Cos';
    Code?: {
      CosBucketName?: string;
      CosObjectName?: string;
    };
    Handler?: string;
    Runtime?: string;
    Namespace?: string;
    Timeout?: number;
    InitTimeout?: number;
    MemorySize?: number;
    PublicNetConfig?: {
      PublicNetStatus: 'ENABLE' | 'DISABLE';
      EipConfig: {
        EipStatus: 'ENABLE' | 'DISABLE';
      };
    };
    L5Enable?: 'TRUE' | 'FALSE';
    Role?: string;
    Description?: string;
    ClsLogsetId?: string;
    ClsTopicId?: string;
    Environment?: { Variables: { Key: string; Value: string }[] };
    VpcConfig?: { VpcId?: string; SubnetId?: string };
    Layers?: { LayerName: string; LayerVersion: number }[];
    DeadLetterConfig?: { Type?: string; Name?: string; FilterType?: string };
    CfsConfig?: {
      CfsInsList: {
        CfsId: string;
        MountInsId: string;
        LocalMountDir: string;
        RemoteMountDir: string;
        UserGroupId: string;
        UserId: string;
      }[];
    };
    AsyncRunEnable?: 'TRUE' | 'FALSE';
  } = {
    FunctionName: inputs.name,
    CodeSource: 'Cos',
    Code: {
      CosBucketName: inputs.code?.bucket,
      CosObjectName: inputs.code?.object,
    },
    Handler: inputs.handler,
    Runtime: inputs.runtime,
    Namespace: inputs.namespace || CONFIGS.defaultNamespace,
    Timeout: +(inputs.timeout || CONFIGS.defaultTimeout),
    InitTimeout: +(inputs.initTimeout || CONFIGS.defaultInitTimeout),
    MemorySize: +(inputs.memorySize || CONFIGS.defaultMemorySize),
    PublicNetConfig: {
      PublicNetStatus: inputs.publicAccess === false ? 'DISABLE' : 'ENABLE',
      EipConfig: {
        EipStatus: inputs.eip === true ? 'ENABLE' : 'DISABLE',
      },
    },
    L5Enable: inputs.l5Enable === true ? 'TRUE' : 'FALSE',
  };

  // 非必须参数
  if (inputs.role) {
    functionInputs.Role = inputs.role;
  }
  if (inputs.description) {
    functionInputs.Description = inputs.description;
  }
  if (inputs.cls) {
    if (inputs.cls.logsetId) {
      functionInputs.ClsLogsetId = inputs.cls.logsetId;
    }
    if (inputs.cls.topicId) {
      functionInputs.ClsTopicId = inputs.cls.topicId;
    }
  }
  if (inputs.environment && inputs.environment.variables) {
    functionInputs.Environment = {
      Variables: [],
    };
    Object.entries(inputs.environment.variables).forEach(([key, val]) => {
      functionInputs.Environment!.Variables.push({
        Key: key,
        Value: String(val),
      });
    });
  }
  if (inputs.vpcConfig) {
    functionInputs.VpcConfig = {};
    if (inputs.vpcConfig.vpcId) {
      functionInputs.VpcConfig.VpcId = inputs.vpcConfig.vpcId;
    }
    if (inputs.vpcConfig.subnetId) {
      functionInputs.VpcConfig.SubnetId = inputs.vpcConfig.subnetId;
    }
  }
  if (inputs.layers) {
    functionInputs.Layers = [];
    inputs.layers.forEach((item: { name: string; version: number }) => {
      functionInputs.Layers!.push({
        LayerName: item.name,
        LayerVersion: item.version,
      });
    });
  }
  if (inputs.deadLetter) {
    functionInputs.DeadLetterConfig = {};
    if (inputs.deadLetter.type) {
      functionInputs.DeadLetterConfig.Type = inputs.deadLetter.type;
    }
    if (inputs.deadLetter.name) {
      functionInputs.DeadLetterConfig.Name = inputs.deadLetter.name;
    }
    if (inputs.deadLetter.filterType) {
      functionInputs.DeadLetterConfig.FilterType = inputs.deadLetter.filterType;
    }
  }

  // cfs config
  if (inputs.cfs) {
    functionInputs.CfsConfig = {
      CfsInsList: [],
    };
    inputs.cfs.forEach((item) => {
      functionInputs.CfsConfig?.CfsInsList.push({
        CfsId: item.cfsId,
        MountInsId: item.MountInsId || item.cfsId,
        LocalMountDir: item.localMountDir,
        RemoteMountDir: item.remoteMountDir,
        UserGroupId: String(item.userGroupId || 10000),
        UserId: String(item.userId || 10000),
      });
    });
  }

  if (inputs.asyncRunEnable !== undefined) {
    functionInputs.AsyncRunEnable = inputs.asyncRunEnable === true ? 'TRUE' : 'FALSE';
  }

  return functionInputs;
};