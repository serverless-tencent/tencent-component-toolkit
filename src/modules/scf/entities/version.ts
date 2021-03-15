import { ScfPublishVersionInputs } from '../interface';

import BaseEntity from './base';

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
}
