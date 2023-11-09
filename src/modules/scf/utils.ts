import { WebServerImageDefaultPort } from './constants';
import { ScfCreateFunctionInputs, BaseFunctionConfig, ProtocolParams } from './interface';
const CONFIGS = require('./config').default;

// get function basement configure
// FIXME: unused variable region
export const formatInputs = (inputs: ScfCreateFunctionInputs) => {
  const functionInputs: BaseFunctionConfig = {
    FunctionName: inputs.name,
    Type: inputs.type === 'web' ? 'HTTP' : 'Event',
    DeployMode: inputs.deployMode === 'image' ? 'image' : 'code',
    Runtime: inputs.runtime,
    Namespace: inputs.namespace || CONFIGS.defaultNamespace,
    Timeout: +(inputs.timeout || CONFIGS.defaultTimeout),
    MemorySize: +(inputs.memorySize || CONFIGS.defaultMemorySize),
    PublicNetConfig: {
      PublicNetStatus: inputs.publicAccess === false ? 'DISABLE' : 'ENABLE',
      EipConfig: {
        EipStatus: inputs.eip === true ? 'ENABLE' : 'DISABLE',
      },
    },
    L5Enable: inputs.l5Enable === true ? 'TRUE' : 'FALSE',
    InstallDependency: inputs.installDependency === true ? 'TRUE' : 'FALSE',
  };

  if (inputs.nodeType) {
    functionInputs.NodeType = inputs.nodeType;
  }

  if (inputs.nodeSpec) {
    functionInputs.NodeSpec = inputs.nodeSpec;
  }

  if (inputs.initTimeout) {
    functionInputs.InitTimeout = inputs.initTimeout;
  }

  // 镜像方式部署
  if (inputs.imageConfig) {
    const { imageConfig } = inputs;
    functionInputs.Code = {
      ImageConfig: {
        ImageType: imageConfig.imageType,
        ImageUri: imageConfig.imageUri,
      },
    };
    if (imageConfig.registryId) {
      functionInputs.Code!.ImageConfig!.RegistryId = imageConfig.registryId;
    }
    if (imageConfig.command) {
      functionInputs.Code!.ImageConfig!.Command = imageConfig.command;
    }
    if (imageConfig.args) {
      functionInputs.Code!.ImageConfig!.Args = imageConfig.args;
    }
    // 镜像加速
    if (imageConfig.containerImageAccelerate !== undefined) {
      functionInputs.Code!.ImageConfig!.ContainerImageAccelerate =
        imageConfig.containerImageAccelerate;
    }
    // 监听端口: -1 表示 job镜像，0 ~ 65526 表示webServer镜像
    if (imageConfig.imagePort) {
      functionInputs.Code!.ImageConfig!.ImagePort =
        Number.isInteger(imageConfig?.imagePort) &&
        imageConfig?.imagePort >= -1 &&
        imageConfig?.imagePort <= 65535
          ? imageConfig.imagePort
          : WebServerImageDefaultPort;
    }
  } else {
    // 基于 COS 代码部署
    functionInputs.Code = {
      CosBucketName: inputs.code?.bucket,
      CosObjectName: inputs.code?.object,
    };
  }

  // 只有 Event 函数才支持
  if (inputs.type !== 'web') {
    functionInputs.Handler = inputs.handler;

    if (inputs.asyncRunEnable !== undefined) {
      functionInputs.AsyncRunEnable = inputs.asyncRunEnable === true ? 'TRUE' : 'FALSE';
    }

    if (inputs.traceEnable !== undefined) {
      functionInputs.TraceEnable = inputs.traceEnable === true ? 'TRUE' : 'FALSE';
    }
  }

  // 非必须参数
  if (inputs.type === 'web') {
    if (inputs.protocolType) {
      functionInputs.ProtocolType = inputs.protocolType;
      if (inputs.protocolParams?.wsParams?.idleTimeOut) {
        const protocolParams: ProtocolParams = {};
        protocolParams.WSParams = { IdleTimeOut: inputs.protocolParams?.wsParams?.idleTimeOut };
        functionInputs.ProtocolParams = protocolParams;
      }
    }
  }

  if (inputs.role) {
    functionInputs.Role = inputs.role;
  }
  if (inputs.description) {
    functionInputs.Description = inputs.description;
  }
  if (inputs.cls) {
    if (inputs.cls.logsetId !== undefined) {
      functionInputs.ClsLogsetId = inputs.cls.logsetId;
    }
    if (inputs.cls.topicId !== undefined) {
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
        MountInsId: item.mountInsId || item.MountInsId || item.cfsId,
        LocalMountDir: item.localMountDir,
        RemoteMountDir: item.remoteMountDir,
        UserGroupId: String(item.userGroupId || 10000),
        UserId: String(item.userId || 10000),
      });
    });
  }

  return functionInputs;
};
