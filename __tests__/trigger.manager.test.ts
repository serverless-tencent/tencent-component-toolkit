import { TriggerManager } from '../src';

describe('Trigger Manager', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const client = new TriggerManager(credentials, 'ap-guangzhou');

  const functionConfig = {
    namespace: 'default',
    name: 'serverless-unit-test',
    qualifier: '$DEFAULT',
  };
  const bucketUrl = `${process.env.BUCKET}-${process.env.TENCENT_APP_ID}.cos.${process.env.REGION}.myqcloud.com`;
  const triggers = [
    {
      function: functionConfig,
      type: 'timer',
      parameters: {
        enable: true,
        cronExpression: '* * */4 * * * *',
        name: 'timer1',
        argument: 'argument',
      },
    },
    {
      function: functionConfig,
      type: 'cos',
      parameters: {
        bucket: bucketUrl,
        enable: true,
        events: 'cos:ObjectCreated:*',
        filter: {
          prefix: 'aaaasad',
          suffix: '.zip',
        },
      },
    },
    {
      function: functionConfig,
      type: 'cls',
      parameters: {
        topicId: '6e60b6c7-a98e-4fc8-8ba8-bdfe4ab9c245',
        qualifier: '$DEFAULT',
        maxWait: 60,
        maxSize: 100,
        enable: true,
      },
    },
    {
      function: functionConfig,
      type: 'clb',
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
    {
      type: 'apigw',
      parameters: {
        serviceName: 'serverless',
        // serviceId: 'service-gt67lpgm',
        serviceDesc: 'Created By Serverless',
        endpoints: [
          {
            function: {
              ...functionConfig,

              functionNamespace: functionConfig.namespace,
              functionName: functionConfig.name,
              functionQualifier: functionConfig.qualifier,
            },
            path: '/',
            method: 'GET',
          },
        ],
      },
    },
  ];

  test('bulk create triggers', async () => {
    const { triggerList } = await client.bulkCreateTriggers(triggers);

    expect(triggerList).toEqual([
      {
        name: functionConfig.name,
        triggers: [
          {
            AddTime: expect.any(String),
            AvailableStatus: 'Available',
            BindStatus: expect.any(String),
            CustomArgument: 'argument',
            Enable: 1,
            ModTime: expect.any(String),
            Qualifier: '$DEFAULT',
            ResourceId: expect.any(String),
            TriggerAttribute: expect.any(String),
            TriggerDesc: '{"cron":"* * */4 * * * *"}',
            TriggerName: 'timer1',
            Type: 'timer',
            triggerType: 'timer',
          },
          {
            AddTime: expect.any(String),
            AvailableStatus: expect.any(String),
            BindStatus: expect.any(String),
            CustomArgument: '',
            Enable: 1,
            ModTime: expect.any(String),
            Qualifier: '$DEFAULT',
            ResourceId: expect.any(String),
            TriggerAttribute: expect.any(String),
            TriggerDesc: expect.stringContaining('"event":"cos:ObjectCreated:*"'),
            TriggerName: expect.stringContaining('cos'),
            Type: 'cos',
            triggerType: 'cos',
          },
          {
            namespace: functionConfig.namespace,
            functionName: functionConfig.name,
            qualifier: functionConfig.qualifier,
            topicId: '6e60b6c7-a98e-4fc8-8ba8-bdfe4ab9c245',
            maxWait: 60,
            maxSize: 100,
            enable: true,
            triggerType: 'cls',
          },
          {
            namespace: functionConfig.namespace,
            functionName: functionConfig.name,
            qualifier: functionConfig.qualifier,
            loadBalanceId: expect.stringContaining('lb-'),
            listenerId: expect.stringContaining('lbl-'),
            locationId: expect.stringContaining('loc-'),
            domain: expect.any(String),
            protocol: 'HTTP',
            port: 80,
            url: '/',
            weight: 20,
            triggerType: 'clb',
          },
          {
            created: expect.any(Boolean),
            serviceId: expect.stringContaining('service-'),
            serviceName: 'serverless',
            subDomain: expect.stringContaining('.apigw.tencentcs.com'),
            url: expect.stringContaining('.apigw.tencentcs.com'),
            protocols: 'http',
            environment: 'release',
            apiList: expect.any(Array),
            triggerType: 'apigw',
          },
        ],
      },
    ]);
  });

  test('bulk remove triggers', async () => {
    const res = await client.clearScfTriggers({
      name: functionConfig.name,
      namespace: functionConfig.namespace,
    });
    expect(res).toBe(true);
  });
});
