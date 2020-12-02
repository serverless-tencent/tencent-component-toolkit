const { sleep } = require('@ygkit/request');
const { Scf, Cfs, Layer } = require('../src');

describe('Scf', () => {
  jest.setTimeout(300000);

  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const scf = new Scf(credentials);
  const vpcConfig = {
    vpcId: process.env.CFS_VPC_ID,
    subnetId: process.env.CFS_SUBNET_ID,
  };

  const inputs = {
    name: `serverless-test-${Date.now()}`,
    code: {
      bucket: process.env.BUCKET,
      object: 'express_code.zip',
    },
    role: 'SCF_QcsRole',
    handler: 'sl_handler.handler',
    runtime: 'Nodejs12.16',
    region: 'ap-guangzhou',
    description: 'Created by Serverless Framework',
    memorySize: 256,
    timeout: 20,
    needSetTraffic: true,
    publish: true,
    traffic: 0.8,
    tags: {
      mytest: 'abc',
    },
    environment: {
      variables: {
        TEST: 'value',
      },
    },
    eip: true,
    vpcConfig: vpcConfig,
    events: [
      {
        timer: {
          name: 'timer',
          parameters: {
            cronExpression: '0 */6 * * * * *',
            enable: true,
            argument: 'mytest argument',
          },
        },
      },
      {
        cos: {
          name: 'cos-trigger',
          parameters: {
            bucket: `${process.env.BUCKET}-${process.env.TENCENT_APP_ID}.cos.${process.env.REGION}.myqcloud.com`,
            enable: true,
            events: 'cos:ObjectCreated:*',
            filter: {
              prefix: 'aaaasad',
              suffix: '.zip',
            },
          },
        },
      },
      {
        apigw: {
          parameters: {
            endpoints: [
              {
                path: '/',
                method: 'GET',
              },
            ],
          },
        },
      },
    ],
  };

  const cfsInputs = {
    fsName: 'cfs-test',
    region: 'ap-guangzhou',
    zone: 'ap-guangzhou-3',
    netInterface: 'VPC',
    vpc: vpcConfig,
  };

  const layerInputs = {
    region: 'ap-guangzhou',
    name: 'layer-test',
    bucket: process.env.BUCKET,
    object: 'node_modules.zip',
    description: 'Layer created by Serverless Component',
    runtimes: ['Nodejs10.15', 'Nodejs12.16'],
  };

  const cfs = new Cfs(credentials);
  const layer = new Layer(credentials);
  let outputs;

  beforeAll(async () => {
    const { fileSystemId } = await cfs.deploy(cfsInputs);
    inputs.cfs = [
      {
        localMountDir: '/mnt/',
        remoteMountDir: '/',
        cfsId: fileSystemId,
      },
    ];
    const { name, version } = await layer.deploy(layerInputs);
    inputs.layers = [
      {
        name,
        version,
      },
    ];
  });

  afterAll(async () => {
    await cfs.remove({
      fsName: cfsInputs.fsName,
      fileSystemId: inputs.cfs[0].cfsId,
    });
    await layer.remove(inputs.layers[0]);
  });

  test('should deploy SCF success', async () => {
    outputs = await scf.deploy(inputs);
    expect(outputs).toEqual({
      Qualifier: '$LATEST',
      Description: 'Created by Serverless Framework',
      Timeout: inputs.timeout,
      InitTimeout: 0,
      MemorySize: inputs.memorySize,
      Runtime: inputs.runtime,
      VpcConfig: { VpcId: vpcConfig.vpcId, SubnetId: vpcConfig.subnetId },
      Environment: {
        Variables: [
          {
            Key: 'TEST',
            Value: 'value',
          },
        ],
      },
      Handler: inputs.handler,
      UseGpu: 'FALSE',
      Role: inputs.role,
      CodeSize: 0,
      FunctionVersion: '$LATEST',
      FunctionName: inputs.name,
      Namespace: 'default',
      InstallDependency: 'FALSE',
      Status: 'Active',
      // Status: expect.any(String),
      AvailableStatus: 'Available',
      StatusDesc: expect.any(String),
      FunctionId: expect.stringContaining('lam-'),
      L5Enable: 'FALSE',
      EipConfig: { EipFixed: 'TRUE', Eips: expect.any(Array) },
      ModTime: expect.any(String),
      AddTime: expect.any(String),
      Layers: [
        {
          LayerName: layerInputs.name,
          LayerVersion: expect.any(Number),
          CompatibleRuntimes: layerInputs.runtimes,
          Description: layerInputs.description,
          LicenseInfo: '',
          AddTime: expect.any(String),
          Status: 'Active',
          Src: 'Default',
        },
      ],
      DeadLetterConfig: { Type: '', Name: '', FilterType: '' },
      OnsEnable: 'FALSE',
      PublicNetConfig: {
        PublicNetStatus: 'ENABLE',
        EipConfig: { EipStatus: 'ENABLE', EipAddress: expect.any(Array) },
      },
      Triggers: [
        {
          AddTime: expect.any(String),
          AvailableStatus: 'Available',
          CustomArgument: inputs.events[0].timer.parameters.argument,
          Enable: 1,
          ModTime: expect.any(String),
          TriggerDesc: `{"cron":"${inputs.events[0].timer.parameters.cronExpression}"}`,
          TriggerName: inputs.events[0].timer.name,
          Type: 'timer',
          BindStatus: '',
          ResourceId: '',
          TriggerAttribute: '',
        },
        {
          AddTime: expect.any(String),
          AvailableStatus: '',
          CustomArgument: '',
          Enable: 1,
          ModTime: expect.any(String),
          TriggerDesc: `{"bucketUrl":"${inputs.events[1].cos.parameters.bucket}","event":"${inputs.events[1].cos.parameters.events}","filter":{"Prefix":"${inputs.events[1].cos.parameters.filter.prefix}","Suffix":"${inputs.events[1].cos.parameters.filter.suffix}"}}`,
          TriggerName: expect.stringContaining('cos_'),
          Type: 'cos',
          BindStatus: '',
          ResourceId: '',
          TriggerAttribute: '',
        },
        {
          created: true,
          serviceId: expect.stringContaining('service-'),
          serviceName: 'serverless_test',
          subDomain: expect.stringContaining('.apigw.tencentcs.com'),
          protocols: 'http',
          environment: 'release',
          apiList: [
            {
              path: '/',
              internalDomain: expect.any(String),
              method: 'GET',
              apiName: 'index',
              apiId: expect.stringContaining('api-'),
              created: true,
              authType: 'NONE',
              businessType: 'NORMAL',
            },
          ],
        },
      ],
      ClsLogsetId: '',
      ClsTopicId: '',
      CodeInfo: '',
      CodeResult: 'success',
      CodeError: '',
      ErrNo: 0,
      Tags: expect.any(Array),
      AccessInfo: { Host: '', Vip: '' },
      Type: 'Event',
      CfsConfig: {
        CfsInsList: [
          {
            UserId: '10000',
            UserGroupId: '10000',
            CfsId: inputs.cfs[0].cfsId,
            MountInsId: inputs.cfs[0].cfsId,
            LocalMountDir: inputs.cfs[0].localMountDir,
            RemoteMountDir: inputs.cfs[0].remoteMountDir,
            IpAddress: expect.any(String),
            MountVpcId: inputs.vpcConfig.vpcId,
            MountSubnetId: inputs.vpcConfig.subnetId,
          },
        ],
      },
      StatusReasons: [],
      RequestId: expect.any(String),
      LastVersion: '1',
      Traffic: inputs.traffic,
      ConfigTrafficVersion: '1',
    });
  });
  test('should invoke Scf success', async () => {
    const res = await scf.invoke({
      functionName: inputs.name,
    });
    expect(res).toEqual({
      Result: {
        MemUsage: expect.any(Number),
        Log: expect.any(String),
        RetMsg: expect.any(String),
        BillDuration: expect.any(Number),
        FunctionRequestId: expect.any(String),
        Duration: expect.any(Number),
        ErrMsg: expect.any(String),
        InvokeResult: expect.anything(),
      },
      RequestId: expect.any(String),
    });
  });
  test('should remove Scf success', async () => {
    const res = await scf.remove({
      functionName: inputs.name,
      ...outputs,
    });
    await sleep(1000);
    expect(res).toEqual(true);
  });
});
