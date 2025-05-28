import { RegionType } from "../../interface";
import Scf from "../../scf";
import { CkafkaTriggerInputsParams, HttpTriggerInputsParams, TriggerDetail, TriggerInputs } from "../interface";
import { TriggerManager } from "../manager";

// 获取函数下指定类型以及指定触发器名称的触发器
export async function  getScfTriggerByName({
    scf,
    inputs
  }: {
    scf: Scf | TriggerManager;
    region: RegionType;
    inputs: TriggerInputs<HttpTriggerInputsParams  | CkafkaTriggerInputsParams>;
  }): Promise<TriggerDetail> {
    const filters = [
      {
        Name: 'Type',
        Values: [inputs?.type || inputs?.Type]
      }
    ]
    if (inputs?.parameters?.name) {
      filters.push({
        Name: 'TriggerName',
        Values: [inputs?.parameters?.name]
      })
    }
    if (inputs?.parameters?.qualifier) {
      filters.push({
        Name: 'Qualifier',
        Values: [inputs?.parameters?.qualifier?.toString()]
      })
    }
    const response = await scf.request({
      Action: 'ListTriggers',
      FunctionName: inputs?.functionName,
      Namespace: inputs?.namespace,
      Limit: 1000,
      Filters: filters
    });
    return response?.Triggers?.[0];
}