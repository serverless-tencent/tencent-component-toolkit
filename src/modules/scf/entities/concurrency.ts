import BaseEntity from './base';

// 文档：https://cloud.tencent.com/document/product/583/51247
interface ScfSetReservedInputs {
  functionName: string;
  namespace?: string;

  reservedMem: number;
}

interface ScfRemoveProvisionedInputs {
  functionName: string;
  namespace?: string;
  qualifier: string;
}

// 文档：https://cloud.tencent.com/document/product/583/51246
interface ScfSetProvisionedInputs {
  functionName: string;
  namespace?: string;

  qualifier: string;
  provisionedNum: number;
}

// https://cloud.tencent.com/document/product/583/51247
interface ScfGetReservedInputs {
  functionName: string;
  namespace: string;
}

interface ScfGetProvisionedInputs {
  functionName: string;
  namespace: string;
}

export class ConcurrencyEntity extends BaseEntity {
  // 设置保留配额
  async setReserved(inputs: ScfSetReservedInputs) {
    console.log(`Set function ${inputs.functionName} reserved`);
    return await this.request({
      Action: 'PutReservedConcurrencyConfig',
      FunctionName: inputs.functionName,
      ReservedConcurrencyMem: inputs.reservedMem,
      Namespace: inputs.namespace,
    });
  }

  async getReserved(inputs: ScfGetReservedInputs) {
    console.log(`Get function ${inputs.functionName} reserved`);
    const res = await this.request({
      Action: 'GetReservedConcurrencyConfig',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,
    });
    return {
      reservedMem: res.ReservedMem,
    };
  }

  async removeProvisioned(inputs: ScfRemoveProvisionedInputs) {
    console.log(`Delete function ${inputs.functionName} qualifier ${inputs.qualifier} provisioned`);
    return await this.request({
      Action: 'DeleteProvisionedConcurrencyConfig',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,

      Qualifier: inputs.qualifier,
    });
  }

  // 设置预置并发
  async setProvisioned(inputs: ScfSetProvisionedInputs) {
    console.log(
      `Set function ${inputs.functionName} qualifier ${inputs.qualifier} provisioned to ${inputs.provisionedNum}`,
    );
    return await this.request({
      Action: 'PutProvisionedConcurrencyConfig',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,

      Qualifier: inputs.qualifier,
      VersionProvisionedConcurrencyNum: inputs.provisionedNum,
    });
  }

  async getProvisioned(inputs: ScfGetProvisionedInputs) {
    console.log(`Get function ${inputs.functionName} provisioned`);
    const res = await this.request({
      Action: 'GetProvisionedConcurrencyConfig',
      FunctionName: inputs.functionName,
      Namespace: inputs.namespace,
    });

    const ret: {
      unallocatedNum: number;
      allocated: {
        allocatedNum: number;
        availableNum: number;
        status: string;
        statusReason: string;
        qualifier: string;
      }[];
    } = {
      unallocatedNum: res.UnallocatedConcurrencyNum as number,
      allocated: res.Allocated.map((v: any) => {
        return {
          allocatedNum: v.AllocatedProvisionedConcurrencyNum,
          availableNum: v.AvailableProvisionedConcurrencyNum,
          status: v.Status,
          statusReason: v.StatusReason,
          qualifier: v.Qualifier,
        };
      }),
    };
    return ret;
  }

  async waitProvisioned(inputs: ScfGetProvisionedInputs) {
    console.log(`Wait for function ${inputs.functionName} set provisioned finish`);
    while (true) {
      const outputs = await this.getProvisioned(inputs);
      let finish = true;
      for (const a of outputs.allocated) {
        if (a.allocatedNum !== a.availableNum) {
          finish = false;
        }
      }

      await new Promise((res) => setTimeout(res, 1000));

      if (finish) {
        break;
      }
    }
  }
}
