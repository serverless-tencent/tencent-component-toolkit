import { strip } from '../../../utils';

import {
  ScfUpdateAliasInputs,
  ScfCreateAlias,
  ScfGetAliasInputs,
  ScfDeleteAliasInputs,
  ScfListAliasInputs,
  PublishVersionAndConfigTraffic,
} from '../interface';

import BaseEntity from './base';

export default class AliasEntity extends BaseEntity {
  async create(inputs: ScfCreateAlias) {
    const publishInputs: any = {
      Action: 'CreateAlias' as const,
      FunctionName: inputs.functionName,
      FunctionVersion: inputs.functionVersion || '$LATEST',
      Name: inputs.aliasName,
      Namespace: inputs.namespace || 'default',
      Description: inputs.description || 'Published by Serverless Component',
      RoutingConfig: {
        AdditionalVersionWeights: inputs.additionalVersions
          ? inputs.additionalVersions?.map((v) => {
              return {
                Version: v.version,
                Weight: v.weight,
              };
            })
          : [],
      },
    };
    const Response = await this.request(publishInputs);
    return Response;
  }

  async update(inputs: ScfUpdateAliasInputs) {
    console.log(
      `Update function ${inputs.functionName} alias ${inputs.aliasName} to version ${inputs.functionVersion}`,
    );
    const publishInputs = {
      Action: 'UpdateAlias' as const,
      FunctionName: inputs.functionName,
      FunctionVersion: inputs.functionVersion || '$LATEST',
      Name: inputs.aliasName || '$DEFAULT',
      Namespace: inputs.namespace || 'default',
      RoutingConfig: {
        AdditionalVersionWeights: inputs.additionalVersions
          ? inputs.additionalVersions?.map((v) => {
              return {
                Version: v.version,
                Weight: v.weight,
              };
            })
          : [],
      },
      Description: inputs.description || 'Configured by Serverless Component',
    };
    const Response = await this.request(publishInputs);
    console.log(`Update function ${inputs.functionName} alias success`);
    return Response;
  }

  async get(inputs: ScfGetAliasInputs) {
    const publishInputs = {
      Action: 'GetAlias' as const,
      FunctionName: inputs.functionName,
      Name: inputs.aliasName || '$DEFAULT',
      Namespace: inputs.namespace || 'default',
    };
    const Response = await this.request(publishInputs);
    return Response;
  }

  async delete(inputs: ScfDeleteAliasInputs) {
    const publishInputs = {
      Action: 'DeleteAlias' as const,
      FunctionName: inputs.functionName,
      Name: inputs.aliasName || '$DEFAULT',
      Namespace: inputs.namespace || 'default',
    };
    const Response = await this.request(publishInputs);
    return Response;
  }

  async list(inputs: ScfListAliasInputs) {
    const publishInputs = {
      Action: 'ListAliases' as const,
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace || 'default',
      FunctionVersion: inputs.functionVersion,
    };
    const Response = await this.request(publishInputs);
    return Response;
  }

  async createWithTraffic(inputs: PublishVersionAndConfigTraffic) {
    const weight = strip(1 - inputs.traffic);
    const publishInputs = {
      Action: 'CreateAlias' as const,
      FunctionName: inputs.functionName,
      FunctionVersion: inputs.functionVersion,
      Name: inputs.aliasName,
      Namespace: inputs.namespace || 'default',
      RoutingConfig: {
        AdditionalVersionWeights: [{ Version: inputs.functionVersion, Weight: weight }],
      },
      Description: inputs.description || 'Published by Serverless Component',
    };
    const Response = await this.request(publishInputs);
    return Response;
  }
}
