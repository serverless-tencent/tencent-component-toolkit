import { sleep } from '@ygkit/request';
import { Scf, Cfs, Layer } from '../../src';
import { ScfDeployInputs } from '../../src/modules/scf/interface';

describe('Scf', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const scf = new Scf(credentials);
  const vpcConfig = {
    vpcId: process.env.CFS_VPC_ID,
    subnetId: process.env.CFS_SUBNET_ID,
  };

  const triggers = {
    apigw: {
      apigw: {
        parameters: {
          serviceName: 'serverless_test',
          endpoints: [
            {
              path: '/',
              method: 'GET',
            },
          ],
        },
      },
    },
    timer: {
      timer: {
        name: 'timer',
        parameters: {
          cronExpression: '0 */6 * * * * *',
          enable: true,
          argument: 'mytest argument',
        },
      },
    },
    cos: {
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
    cls: {
      cls: {
        parameters: {
          topicId: '6e60b6c7-a98e-4fc8-8ba8-bdfe4ab9c245',
          qualifier: '$DEFAULT',
          maxWait: 60,
          maxSize: 100,
          enable: true,
        },
      },
    },
    clb: {
      clb: {
        parameters: {
          qualifier: '$DEFAULT',
          loadBalanceId: 'lb-l6golr1k',
          protocol: 'HTTP',
          domain: '81.71.86.84',
          port: 80,
          url: '/',
          weight: 20,
        },
      },
    },
    // mps: {
    //   mps: {
    //     parameters: {
    //       qualifier: '$DEFAULT',
    //       type: 'EditMediaTask',
    //       enable: true,
    //     },
    //   },
    // },
  };

  const events = Object.entries(triggers).map(([, value]) => value);

  const inputs: ScfDeployInputs = {
    name: `serverless-test-${Date.now()}`,
    code: {
      bucket: process.env.BUCKET,
      object: 'express_code.zip',
    },
    namespace: 'test',
    role: 'SCF_QcsRole',
    handler: 'sl_handler.handler',
    runtime: 'Nodejs12.16',
    region: 'ap-guangzhou',
    description: 'Created by Serverless',
    memorySize: 256,
    timeout: 20,
    needSetTraffic: true,
    publish: true,
    traffic: 0.8,
    tags: {
      test: 'test',
    },
    environment: {
      variables: {
        TEST: 'value',
      },
    },
    eip: true,
    vpcConfig: vpcConfig,
    events,
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
    description: 'Created by Serverless Component',
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

  afterAll(async (done) => {
    await sleep(3000);
    await cfs.remove({
      fsName: cfsInputs.fsName,
      fileSystemId: inputs.cfs[0].cfsId,
    });
    await layer.remove(inputs.layers[0]);
    done();
  });

  test('deploy', async () => {
    await sleep(3000);
    outputs = await scf.deploy(inputs);
    expect(outputs.Qualifier).toBe('$LATEST');
    expect(outputs.Description).toBe('Created by Serverless');
    expect(outputs.Timeout).toBe(inputs.timeout);
    expect(outputs.MemorySize).toBe(inputs.memorySize);
    expect(outputs.Runtime).toBe(inputs.runtime);
    expect(outputs.Handler).toBe(inputs.handler);
    expect(outputs.Role).toBe(inputs.role);
    expect(outputs.VpcConfig).toEqual({ VpcId: vpcConfig.vpcId, SubnetId: vpcConfig.subnetId });
    expect(outputs.FunctionName).toBe(inputs.name);
    expect(outputs.Environment).toEqual({
      Variables: [
        {
          Key: 'TEST',
          Value: 'value',
        },
      ],
    });
    expect(outputs.AsyncRunEnable).toBe('FALSE');
    expect(outputs.Status).toBe('Active');
    expect(outputs.EipConfig).toEqual({ EipFixed: 'TRUE', Eips: expect.any(Array) });

    expect(outputs.Layers[0].LayerName).toBe(layerInputs.name);
    expect(outputs.Layers[0].CompatibleRuntimes).toEqual(layerInputs.runtimes);
    expect(outputs.Layers[0].Description).toBe(layerInputs.description);

    expect(outputs.PublicNetConfig).toEqual({
      PublicNetStatus: 'ENABLE',
      EipConfig: { EipStatus: 'ENABLE', EipAddress: expect.any(Array) },
    });
    expect(outputs.Tags).toEqual([
      {
        Key: 'test',
        Value: 'test',
      },
    ]);
    expect(outputs.CfsConfig).toEqual({
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
    });
    expect(outputs.LastVersion).toBe('1');
    expect(outputs.Traffic).toBe(inputs.traffic);
    expect(outputs.ConfigTrafficVersion).toBe('1');
    expect(outputs.InstallDependency).toBe('FALSE');
    expect(outputs.AsyncRunEnable).toBe('FALSE');
    expect(outputs.TraceEnable).toBe('FALSE');

    // expect triggers result
    expect(outputs.Triggers).toEqual([
      {
        NeedCreate: expect.any(Boolean),
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
            isBase64Encoded: false,
            url: expect.stringContaining('http'),
          },
        ],
        url: expect.stringContaining('http'),
      },
      {
        NeedCreate: expect.any(Boolean),
        AddTime: expect.any(String),
        AvailableStatus: expect.any(String),
        CustomArgument: triggers.timer.timer.parameters.argument,
        Enable: 1,
        ModTime: expect.any(String),
        TriggerDesc: `{"cron":"${triggers.timer.timer.parameters.cronExpression}"}`,
        TriggerName: triggers.timer.timer.name,
        Type: 'timer',
        BindStatus: expect.any(String),
        ResourceId: expect.any(String),
        TriggerAttribute: expect.any(String),
        Qualifier: expect.any(String),
      },
      {
        NeedCreate: expect.any(Boolean),
        AddTime: expect.any(String),
        AvailableStatus: expect.any(String),
        CustomArgument: expect.any(String),
        Enable: 1,
        ModTime: expect.any(String),
        TriggerDesc: `{"bucketUrl":"${triggers.cos.cos.parameters.bucket}","event":"${triggers.cos.cos.parameters.events}","filter":{"Prefix":"${triggers.cos.cos.parameters.filter.prefix}","Suffix":"${triggers.cos.cos.parameters.filter.suffix}"}}`,
        TriggerName: expect.stringContaining('cos'),
        Type: 'cos',
        BindStatus: expect.any(String),
        ResourceId: expect.any(String),
        TriggerAttribute: expect.any(String),
        Qualifier: expect.any(String),
      },
      {
        NeedCreate: expect.any(Boolean),
        enable: triggers.cls.cls.parameters.enable,
        namespace: inputs.namespace || 'default',
        functionName: inputs.name,
        maxSize: triggers.cls.cls.parameters.maxSize,
        maxWait: triggers.cls.cls.parameters.maxWait,
        qualifier: triggers.cls.cls.parameters.qualifier,
        topicId: triggers.cls.cls.parameters.topicId,
      },
      // {
      //   enable: triggers.mps.mps.parameters.enable,
      //   namespace: inputs.namespace || 'default',
      //   functionName: inputs.name,
      //   qualifier: triggers.mps.mps.parameters.qualifier,
      //   type: triggers.mps.mps.parameters.type,
      //   resourceId: expect.stringContaining(
      //     `TriggerType/${triggers.mps.mps.parameters.type}Event`,
      //   ),
      // },
      {
        NeedCreate: expect.any(Boolean),
        namespace: inputs.namespace || 'default',
        functionName: inputs.name,
        qualifier: expect.any(String),
        loadBalanceId: triggers.clb.clb.parameters.loadBalanceId,
        listenerId: expect.stringContaining('lbl-'),
        locationId: expect.stringContaining('loc-'),
        domain: triggers.clb.clb.parameters.domain,
        protocol: triggers.clb.clb.parameters.protocol,
        port: triggers.clb.clb.parameters.port,
        url: triggers.clb.clb.parameters.url,
        weight: triggers.clb.clb.parameters.weight,
      },
    ]);
  });
  test('update', async () => {
    await sleep(3000);
    outputs = await scf.deploy(inputs);
    expect(outputs.Qualifier).toBe('$LATEST');
    expect(outputs.Description).toBe('Created by Serverless');
    expect(outputs.Timeout).toBe(inputs.timeout);
    expect(outputs.MemorySize).toBe(inputs.memorySize);
    expect(outputs.Runtime).toBe(inputs.runtime);
    expect(outputs.Handler).toBe(inputs.handler);
    expect(outputs.Role).toBe(inputs.role);
    expect(outputs.VpcConfig).toEqual({ VpcId: vpcConfig.vpcId, SubnetId: vpcConfig.subnetId });
    expect(outputs.FunctionName).toBe(inputs.name);
    expect(outputs.Environment).toEqual({
      Variables: [
        {
          Key: 'TEST',
          Value: 'value',
        },
      ],
    });
    expect(outputs.AsyncRunEnable).toBe('FALSE');
    expect(outputs.Status).toBe('Active');
    expect(outputs.EipConfig).toEqual({ EipFixed: 'TRUE', Eips: expect.any(Array) });

    expect(outputs.Layers[0].LayerName).toBe(layerInputs.name);
    expect(outputs.Layers[0].CompatibleRuntimes).toEqual(layerInputs.runtimes);
    expect(outputs.Layers[0].Description).toBe(layerInputs.description);

    expect(outputs.PublicNetConfig).toEqual({
      PublicNetStatus: 'ENABLE',
      EipConfig: { EipStatus: 'ENABLE', EipAddress: expect.any(Array) },
    });
    expect(outputs.Tags).toEqual([
      {
        Key: 'test',
        Value: 'test',
      },
    ]);
    expect(outputs.CfsConfig).toEqual({
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
    });
    expect(outputs.LastVersion).toBe('2');
    expect(outputs.Traffic).toBe(inputs.traffic);
    expect(outputs.ConfigTrafficVersion).toBe('2');
    expect(outputs.InstallDependency).toBe('FALSE');
    expect(outputs.AsyncRunEnable).toBe('FALSE');
    expect(outputs.TraceEnable).toBe('FALSE');

    // expect triggers result
    expect(outputs.Triggers).toEqual([
      {
        NeedCreate: expect.any(Boolean),
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
            isBase64Encoded: false,
            url: expect.stringContaining('http'),
          },
        ],
        url: expect.stringContaining('http'),
      },
      {
        NeedCreate: expect.any(Boolean),
        AddTime: expect.any(String),
        AvailableStatus: expect.any(String),
        CustomArgument: triggers.timer.timer.parameters.argument,
        Enable: 1,
        ModTime: expect.any(String),
        TriggerDesc: `{"cron":"${triggers.timer.timer.parameters.cronExpression}"}`,
        TriggerName: triggers.timer.timer.name,
        Type: 'timer',
        BindStatus: expect.any(String),
        ResourceId: expect.any(String),
        TriggerAttribute: expect.any(String),
        Qualifier: expect.any(String),
      },
      {
        NeedCreate: expect.any(Boolean),
        AddTime: expect.any(String),
        AvailableStatus: expect.any(String),
        CustomArgument: expect.any(String),
        Enable: 1,
        ModTime: expect.any(String),
        TriggerDesc: `{"bucketUrl":"${triggers.cos.cos.parameters.bucket}","event":"${triggers.cos.cos.parameters.events}","filter":{"Prefix":"${triggers.cos.cos.parameters.filter.prefix}","Suffix":"${triggers.cos.cos.parameters.filter.suffix}"}}`,
        TriggerName: expect.stringContaining('cos'),
        Type: 'cos',
        BindStatus: expect.any(String),
        ResourceId: expect.any(String),
        TriggerAttribute: expect.any(String),
        Qualifier: expect.any(String),
      },
      {
        NeedCreate: expect.any(Boolean),
        enable: triggers.cls.cls.parameters.enable,
        namespace: inputs.namespace || 'default',
        functionName: inputs.name,
        maxSize: triggers.cls.cls.parameters.maxSize,
        maxWait: triggers.cls.cls.parameters.maxWait,
        qualifier: triggers.cls.cls.parameters.qualifier,
        topicId: triggers.cls.cls.parameters.topicId,
      },
      // {
      //   enable: triggers.mps.mps.parameters.enable,
      //   namespace: inputs.namespace || 'default',
      //   functionName: inputs.name,
      //   qualifier: triggers.mps.mps.parameters.qualifier,
      //   type: triggers.mps.mps.parameters.type,
      //   resourceId: expect.stringContaining(
      //     `TriggerType/${triggers.mps.mps.parameters.type}Event`,
      //   ),
      // },
      {
        NeedCreate: expect.any(Boolean),
        namespace: inputs.namespace || 'default',
        functionName: inputs.name,
        qualifier: expect.any(String),
        loadBalanceId: triggers.clb.clb.parameters.loadBalanceId,
        listenerId: expect.stringContaining('lbl-'),
        locationId: expect.stringContaining('loc-'),
        domain: triggers.clb.clb.parameters.domain,
        protocol: triggers.clb.clb.parameters.protocol,
        port: triggers.clb.clb.parameters.port,
        url: triggers.clb.clb.parameters.url,
        weight: triggers.clb.clb.parameters.weight,
      },
    ]);
  });
  test('invoke', async () => {
    const res = await scf.invoke({
      namespace: inputs.namespace,
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
  test('get function logs', async () => {
    const logs = await scf.logs({
      functionName: inputs.name,
      namespace: inputs.namespace,
    });

    expect(logs).toBeInstanceOf(Array);
  });
  test('[remove cls] update', async () => {
    await sleep(3000);
    inputs.cls = {
      logsetId: '',
      topicId: '',
    };
    outputs = await scf.deploy(inputs);

    expect(outputs.ClsLogsetId).toBe('');
    expect(outputs.ClsTopicId).toBe('');
  });

  test('[ignoreTriggers = true] update', async () => {
    await sleep(3000);
    inputs.ignoreTriggers = true;
    outputs = await scf.deploy(inputs);

    // expect triggers result
    expect(outputs.Triggers).toEqual([]);
  });

  test('get request status', async () => {
    const invokeRes = await scf.invoke({
      namespace: inputs.namespace,
      functionName: inputs.name,
    });

    console.log(invokeRes);

    const inputParams = {
      functionName: inputs.name,
      functionRequestId: invokeRes.Result.FunctionRequestId,
      namespace: inputs.namespace,
      // startTime: "2022-01-06 20:00:00",
      // endTime: "2022-12-16 20:00:00"
    };

    const res = await scf.scf.getRequestStatus(inputParams);
    console.log(res);
    expect(res.TotalCount).toEqual(1);
  });

  test('remove', async () => {
    const res = await scf.remove({
      functionName: inputs.name,
      ...outputs,
    });
    expect(res).toEqual(true);
  });
});
