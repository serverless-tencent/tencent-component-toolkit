import { ScfPublishVersionInputs } from '../interface';

import BaseEntity from './base';

export interface ScfListVersionInputs {
  functionName: string;
  namespace?: string;
  offset?: number;
  limit?: number;
}

export default class VersionEntity extends BaseEntity {
  /**
   * publish function version
   * @param {object} inputs publish version parameter
   */
  async publish(inputs: ScfPublishVersionInputs = {}) {
    console.log(`Publishing function ${inputs.functionName} version`);
    const publishInputs = {
      Action: 'PublishVersion' as const,
      FunctionName: inputs.functionName,
      Description: inputs.description || 'Published by Serverless Component',
      Namespace: inputs.namespace || 'default',
    };
    const Response = await this.request(publishInputs);

    console.log(`Published function ${inputs.functionName} version ${Response.FunctionVersion}`);
    return Response;
  }

  async list(inputs: ScfListVersionInputs) {
    const listInputs = {
      Action: 'ListVersionByFunction' as const,
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace ?? 'default',
      Offset: inputs.offset ?? 0,
      Limit: inputs.limit ?? 100,
    };
    const Response = await this.request(listInputs);

    console.log(`Published function ${inputs.functionName} version ${Response.FunctionVersion}`);
    return Response;
  }
}
