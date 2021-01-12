import { RegionType, CapiCredentials } from './../interface';
import apigwUtils from '../apigw';
import { MultiApigwDeployInputs, MultiApigwRemoveInputs } from './interface';

export default class MultiApigw {
  regionList: RegionType[];
  credentials:  CapiCredentials;

  constructor(credentials:CapiCredentials = {}, region:RegionType) {
    this.regionList = typeof region == 'string' ? [region] : region;
    this.credentials = credentials;
  }

  mergeJson(sourceJson:any, targetJson:any) {
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

  async doDeploy(tempInputs:any, output:any) {
    const scfClient = new apigwUtils(this.credentials, tempInputs.region);
    output[tempInputs.region] = await scfClient.deploy(tempInputs);
  }

  async doDelete(tempInputs:any, region:RegionType) {
    const scfClient = new apigwUtils(this.credentials, region);
    await scfClient.remove(tempInputs);
  }

  async deploy(inputs:MultiApigwDeployInputs = {} as any) {
    if (!this.regionList) {
      this.regionList = typeof inputs.region === 'string' ? [inputs.region] as RegionType[] : inputs.region;
    }

    const baseInputs:MultiApigwDeployInputs = {} as any;
    for (const eveKey in inputs) {
      if (eveKey != 'region' && eveKey.indexOf('ap-') != 0) {
        (baseInputs as any)[eveKey] = (inputs as any)[eveKey];
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

  async remove(inputs: MultiApigwRemoveInputs = {} as any) {
    const apigwHandler = [];
    for (const item in inputs) {
      const r = item as RegionType;
      apigwHandler.push(this.doDelete(inputs[r], r));
    }
    await Promise.all(apigwHandler);
    return {};
  }
}