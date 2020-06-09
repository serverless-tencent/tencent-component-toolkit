const scfUtils = require('../scf/index');

class MultiScf {
  constructor(credentials = {}, region) {
    this.regionList = typeof region == 'string' ? [region] : region;
    this.credentials = credentials;
  }

  mergeJson(sourceJson, targetJson) {
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

  async doDeploy(tempInputs, output) {
    const scfClient = new scfUtils(this.credentials, tempInputs.region);
    output[tempInputs.region] = await scfClient.deploy(tempInputs);
  }

  async doDelete(tempInputs, region) {
    const scfClient = new scfUtils(this.credentials, region);
    await scfClient.remove(tempInputs);
  }

  async deploy(inputs = {}) {
    if (!this.regionList) {
      this.regionList = typeof inputs.region == 'string' ? [inputs.region] : inputs.region;
    }
    const baseInputs = {};
    const functions = {};

    for (const eveKey in inputs) {
      if (eveKey != 'region' && eveKey.indexOf('ap-') != 0) {
        baseInputs[eveKey] = inputs[eveKey];
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

  async remove(inputs = {}) {
    const functionHandler = [];
    for (const item in inputs) {
      functionHandler.push(this.doDelete(inputs[item], item));
    }
    await Promise.all(functionHandler);
    return {};
  }
}

module.exports = MultiScf;
