import {
  EbDeployInputs,
  EbDeployOutputs,
  EventConnectionItem,
  // EventConnectionItem,
  EventConnectionOutputs,
} from '../src/modules/eb/interface';
import { EventBridge } from '../src';
import { getQcsResourceId } from '../src/utils';

describe('eb', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const eb = new EventBridge(credentials);
  const inputs: EbDeployInputs = {
    type: 'Cloud',
    eventBusName: 'unit-test-eb',
    description: 'test eb deploy',
    uin: process.env.TENCENT_UIN,
    // 目前仅支持广州区
    region: 'ap-guangzhou',
    connections: [
      {
        connectionName: 'test-conn-01',
        description: 'test connection binding',
        enable: true,
        type: 'apigw',
        // connectionDescription: {
        //   serviceId: 'service-abcd123',
        //   gwParams: {
        //     Protocol: 'HTTP',
        //     Method: 'POST',
        //   },
        // },
      },
    ],
    rules: [
      {
        ruleName: 'test-rule-01',
        eventPattern: '{\n  "source": ["apigw.cloud.tencent"]\n}',
        enable: true,
        description: 'test rule deploy',
        type: 'Cloud',
        targets: [
          {
            type: 'scf',
            functionName: 'serverless-unit-test',
            functionNamespace: 'default',
            functionVersion: '$DEFAULT',
          },
        ],
      },
    ],
  };
  let outputs: EbDeployOutputs;
  let testConnInfo: EventConnectionOutputs;

  test('[Auto Connection] should deploy a event bridge success', async () => {
    outputs = await eb.deploy(inputs);
    expect(outputs.type).toEqual(inputs.type);
    expect(outputs.eventBusName).toEqual(inputs.eventBusName);
    expect(outputs.description).toEqual(inputs.description);
    inputs.eventBusId = outputs.eventBusId;

    expect(outputs.connections).toHaveLength(1);
    expect(outputs.connections[0].connectionName).toEqual(inputs.connections[0].connectionName);
    expect(outputs.connections[0].type).toEqual(inputs.connections[0].type);
    expect(outputs.connections[0].connectionDescription.APIGWParams).toEqual({
      Protocol: 'HTTP',
      Method: 'POST',
    });
    // 获取自动创建的API网关，便于后续测试
    inputs.connections[0].connectionId = outputs.connections[0].connectionId;
    const qcsItems = outputs.connections[0].connectionDescription.ResourceDescription.split('/');
    const tempServiceId = qcsItems[qcsItems.length - 1];
    inputs.connections[0].connectionDescription = {
      serviceId: tempServiceId,
      gwParams: outputs.connections[0].connectionDescription.APIGWParams,
    };
    testConnInfo = outputs.connections[0];

    expect(outputs.rules).toHaveLength(1);
    expect(outputs.rules[0].ruleName).toEqual(inputs.rules[0].ruleName);
    expect(outputs.rules[0].type).toEqual(inputs.rules[0].type);
    expect(outputs.rules[0].description).toEqual(inputs.rules[0].description);
    expect(outputs.rules[0].eventPattern).toEqual(inputs.rules[0].eventPattern);
    expect(outputs.rules[0].targets).toHaveLength(1);
    inputs.rules[0].ruleId = outputs.rules[0].ruleId;

    const inputTarget = inputs.rules[0].targets[0];
    expect(outputs.rules[0].targets[0].type).toEqual(inputTarget.type);
    const resourceId = getQcsResourceId(
      'scf',
      'ap-guangzhou',
      process.env.TENCENT_UIN,
      `namespace/${inputTarget.functionNamespace}/function/${inputTarget.functionName}/${inputTarget.functionVersion}`,
    );
    expect(outputs.rules[0].targets[0].targetDescription.resourceDescription).toEqual(resourceId);
    inputs.rules[0].targets[0].targetId = outputs.rules[0].targets[0].targetId;
  });

  /* TODO: 由于更新接口的问题，等后台修复后再测 */
  test('[Auto Connection] should update event bridge success', async () => {
    inputs.eventBusName = 'new-eb-01';
    const newConn = {
      connectionName: 'test-conn-02',
      description: 'test connection binding',
      type: 'apigw',
      enable: true,
      connectionDescription: {
        // resourceDescription: inputs.connections[0].connectionDescription.resourceDescription,
        serviceId: inputs.connections[0].connectionDescription.serviceId,
        gwParams: { Protocol: 'HTTP', Method: 'GET' },
      },
    };
    inputs.connections.push(newConn as EventConnectionItem);
    inputs.connections[0].connectionName = 'new-conn-01';
    inputs.rules[0].ruleName = 'new-rule-01';

    outputs = await eb.deploy(inputs);
    expect(outputs.eventBusName).toEqual(inputs.eventBusName);
    expect(outputs.rules[0].ruleName).toEqual(inputs.rules[0].ruleName);
    expect(outputs.connections).toHaveLength(2);
    expect(outputs.connections[0].connectionName).toEqual(inputs.connections[0].connectionName);
    expect(outputs.connections[1].connectionName).toEqual(inputs.connections[1].connectionName);
    expect(outputs.connections[1].type).toEqual(inputs.connections[1].type);
    const targetResDesc = getQcsResourceId(
      'apigw',
      'ap-guangzhou',
      process.env.TENCENT_UIN,
      `serviceid/${inputs.connections[1].connectionDescription.serviceId}`,
    );
    expect(outputs.connections[1].connectionDescription.ResourceDescription).toEqual(targetResDesc);
    expect(outputs.connections[1].connectionDescription.APIGWParams).toEqual(
      inputs.connections[1].connectionDescription.gwParams,
    );
  });

  test('[Auto Connection] should remove event bridge success', async () => {
    const res = await eb.remove(outputs.eventBusId);
    expect(res).toEqual(true);
  });

  test('[Spec Connection] should deploy event bridge success', async () => {
    const qcsItems = testConnInfo.connectionDescription.ResourceDescription.split('/');
    const tempServiceId = qcsItems[qcsItems.length - 1];
    const newInput: EbDeployInputs = {
      type: 'Cloud',
      eventBusName: 'test-eb-02',
      description: 'test eb deploy',
      uin: process.env.TENCENT_UIN,
      region: 'ap-guangzhou',
      connections: [
        {
          connectionName: 'test-conn-01',
          description: 'test connection binding',
          enable: true,
          type: 'apigw',
          connectionDescription: {
            serviceId: tempServiceId,
            gwParams: testConnInfo.connectionDescription.APIGWParams,
          },
        },
      ],
      rules: [
        {
          ruleName: 'test-rule',
          eventPattern: '{\n  "source": ["apigw.cloud.tencent"]\n}',
          enable: true,
          description: 'test rule deploy',
          type: 'Cloud',
          targets: [
            {
              type: 'scf',
              functionName: 'serverless-unit-test',
              functionNamespace: 'default',
              functionVersion: '$DEFAULT',
            },
          ],
        },
      ],
    };
    outputs = await eb.deploy(newInput);
    expect(outputs.eventBusName).toEqual(newInput.eventBusName);
    const targetResDesc = getQcsResourceId(
      'apigw',
      'ap-guangzhou',
      process.env.TENCENT_UIN,
      `serviceid/${newInput.connections[0].connectionDescription.serviceId}`,
    );
    expect(outputs.connections[0].connectionDescription.ResourceDescription).toEqual(targetResDesc);
    expect(outputs.connections[0].connectionDescription.APIGWParams).toEqual(
      newInput.connections[0].connectionDescription.gwParams,
    );
    expect(outputs.rules).toHaveLength(1);
    expect(outputs.rules[0].ruleName).toEqual(newInput.rules[0].ruleName);
    expect(outputs.rules[0].targets).toHaveLength(1);
  });

  test('[Spec Connection] should remove event bridge success', async () => {
    const res = await eb.remove(outputs.eventBusId);
    expect(res).toEqual(true);
  });

  test('[Without Connections and Rules] should create event success', async () => {
    const newInput: EbDeployInputs = {
      type: 'Cloud',
      eventBusName: 'test-eb-03',
      description: 'test eb deploy',
      uin: process.env.TENCENT_UIN,
      region: 'ap-guangzhou',
    };
    outputs = await eb.deploy(newInput);
    expect(outputs.eventBusName).toEqual(newInput.eventBusName);
  });

  test('[Without Connections and Rules] should remove event success', async () => {
    const res = await eb.remove(outputs.eventBusId);
    expect(res).toEqual(true);
  });
});
