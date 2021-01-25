import { ScfRemoveInputs } from './../scf/interface';
import { ScfDeployInputs } from './../scf/interface';
import { CapiCredentials, RegionType } from './../interface';
import scfUtils from '../scf/index';
import { MultiScfDeployInputs, MultiScfRemoveInputs, MultiScfDeployOutputs } from './interface';

export default class MultiScf {
  credentials: CapiCredentials;
  regionList: RegionType[];
  constructor(credentials = {}, region: RegionType | RegionType[] = 'ap-guangzhou') {
    this.regionList = typeof region == 'string' ? [region] : region;
    this.credentials = credentials;
  }

  mergeJson(sourceJson: any, targetJson: any) {
    for (const eveKey in sourceJson) {
      if (targetJson.hasOwnProperty(eveKey)) {
        if (eveKey == 'events') {
          for (let i = 0; i < sourceJson[eveKey].length; i++) {
            const sourceEvents = JSON.stringify(sourceJson[eveKey][i]);
            const targetEvents = JSON.stringify(targetJson[eveKey]);
            if (targetEvents.indexOf(sourceEvents) == -1) {
              targetJson[eveKey].push(sourceJson[eveKey][i]);
            }
          }
        } else {
          if (typeof sourceJson[eveKey] != 'string') {
            this.mergeJson(sourceJson[eveKey], targetJson[eveKey]);
          } else {
            targetJson[eveKey] = sourceJson[eveKey];
          }
        }
      } else {
        targetJson[eveKey] = sourceJson[eveKey];
      }
    }
    return targetJson;
  }

  async doDeploy(tempInputs: ScfDeployInputs, output: MultiScfDeployOutputs) {
    const scfClient = new scfUtils(this.credentials, tempInputs.region);
    output[tempInputs.region!] = await scfClient.deploy(tempInputs);
  }

  async doDelete(tempInputs: ScfRemoveInputs, region: RegionType) {
    const scfClient = new scfUtils(this.credentials, region);
    await scfClient.remove(tempInputs);
  }

  async deploy(inputs: MultiScfDeployInputs = {}) {
    if (!this.regionList) {
      this.regionList = typeof inputs.region == 'string' ? [inputs.region] : inputs.region ?? [];
    }
    const baseInputs: Partial<Record<RegionType, ScfDeployInputs>> = {};
    const functions: MultiScfDeployOutputs = {};

    for (const eveKey in inputs) {
      const rk: RegionType = eveKey;
      if (eveKey != 'region' && eveKey.indexOf('ap-') != 0) {
        baseInputs[rk] = inputs[rk];
      }
    }
    const functionHandler = [];
    for (let i = 0; i < this.regionList.length; i++) {
      let tempInputs = JSON.parse(JSON.stringify(baseInputs)); // clone
      tempInputs.region = this.regionList[i];
      if (inputs[this.regionList[i]]) {
        tempInputs = this.mergeJson(inputs[this.regionList[i]], tempInputs);
      }
      functionHandler.push(this.doDeploy(tempInputs, functions));
    }

    await Promise.all(functionHandler);

    return functions;
  }

  async remove(inputs: MultiScfRemoveInputs = {}) {
    const functionHandler = [];
    for (const item in inputs) {
      const region: RegionType = item;
      functionHandler.push(this.doDelete(inputs[region]!, region));
    }
    await Promise.all(functionHandler);
    return {};
  }
}
