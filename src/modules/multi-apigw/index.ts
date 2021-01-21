import { ApigwDeployInputs, ApigwRemoveInputs } from './../apigw/interface';
import { RegionType, CapiCredentials } from './../interface';
import Apigw from '../apigw';
import {
  MultiApigwDeployInputs,
  MultiApigwRemoveInputs,
  MultiApigwDeployOutputs,
} from './interface';

/** 多地狱 API 网关 */
export default class MultiApigw {
  regionList: RegionType[];
  credentials: CapiCredentials;

  constructor(
    credentials: CapiCredentials = {},
    region: RegionType | RegionType[] = 'ap-guangzhou',
  ) {
    this.regionList = typeof region == 'string' ? [region] : region;
    this.credentials = credentials;
  }

  mergeJson(sourceJson: any, targetJson: any) {
    for (const eveKey in sourceJson) {
      if (targetJson.hasOwnProperty(eveKey)) {
        if (['protocols', 'endpoints', 'customDomain'].indexOf(eveKey) != -1) {
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

  async doDeploy(tempInputs: ApigwDeployInputs, output: MultiApigwDeployOutputs) {
    // FIXME: why apigw is called scfClient?
    // const scfClient = new apigw(this.credentials, tempInputs.region);
    const apigw = new Apigw(this.credentials, tempInputs.region);
    output[tempInputs.region] = await apigw.deploy(tempInputs);
  }

  async doDelete(tempInputs: ApigwRemoveInputs, region: RegionType) {
    const apigw = new Apigw(this.credentials, region);
    await apigw.remove(tempInputs);
  }

  async deploy(inputs: MultiApigwDeployInputs = {}) {
    if (!this.regionList) {
      this.regionList = (typeof inputs.region === 'string' ? [inputs.region] : inputs.region) ?? [];
    }

    const baseInputs: MultiApigwDeployInputs = {};
    for (const eveKey in inputs) {
      if (eveKey != 'region' && eveKey.indexOf('ap-') != 0) {
        baseInputs[eveKey] = inputs[eveKey];
      }
    }

    if (inputs.serviceId && this.regionList.length > 1) {
      throw new Error(
        'For multi region deployment, please specify serviceid under the corresponding region',
      );
    }

    const apigwOutputs = {};
    const apigwHandler = [];
    for (let i = 0; i < this.regionList.length; i++) {
      let tempInputs = JSON.parse(JSON.stringify(baseInputs)); // clone
      tempInputs.region = this.regionList[i];
      if (inputs[this.regionList[i]]) {
        tempInputs = this.mergeJson(inputs[this.regionList[i]], tempInputs);
      }
      apigwHandler.push(this.doDeploy(tempInputs, apigwOutputs));
    }

    await Promise.all(apigwHandler);
    return apigwOutputs;
  }

  async remove(inputs: MultiApigwRemoveInputs = {}) {
    const apigwHandler = [];
    for (const item in inputs) {
      const r = item as RegionType;
      apigwHandler.push(this.doDelete(inputs[r], r));
    }
    await Promise.all(apigwHandler);
    return {};
  }
}
