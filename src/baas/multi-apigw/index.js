const apigwUtils = require('../apigw/index')

class TencentAPIGWMultiRegion {
	constructor(credentials = {}, region) {
		this.regionList = typeof region == 'string' ? [region] : region
		this.credentials = credentials
	}

	mergeJson(sourceJson, targetJson) {
		for (const eveKey in sourceJson) {
			if (targetJson.hasOwnProperty(eveKey)) {
				if (['protocols', 'endpoints', 'customDomain'].indexOf(eveKey) != -1) {
					for (let i = 0; i < sourceJson[eveKey].length; i++) {
						const sourceEvents = JSON.stringify(sourceJson[eveKey][i])
						const targetEvents = JSON.stringify(targetJson[eveKey])
						if (targetEvents.indexOf(sourceEvents) == -1) {
							targetJson[eveKey].push(sourceJson[eveKey][i])
						}
					}
				} else {
					if (typeof sourceJson[eveKey] != 'string') {
						this.mergeJson(sourceJson[eveKey], targetJson[eveKey])
					} else {
						targetJson[eveKey] = sourceJson[eveKey]
					}
				}
			} else {
				targetJson[eveKey] = sourceJson[eveKey]
			}
		}
		return targetJson
	}


	async doDeploy(tempInputs, output) {
		const scfClient = new apigwUtils(this.credentials, tempInputs.region)
		output[tempInputs.region] = await scfClient.deploy(tempInputs)
	}

	async doDelete(tempInputs, region) {
		const scfClient = new apigwUtils(this.credentials, region)
		await scfClient.remove(tempInputs)
	}

	async deploy(inputs = {}) {
		if (!this.regionList) {
			this.regionList = typeof inputs.region == 'string' ? [inputs.region] : inputs.region
		}

		const baseInputs = {}
		for (const eveKey in inputs) {
			if (eveKey != 'region' && eveKey.indexOf('ap-') != 0) {
				baseInputs[eveKey] = inputs[eveKey]
			}
		}

		const apigwOutputs = {}

		if (inputs.serviceId && this.regionList.length > 1) {
			throw new Error(
				'For multi region deployment, please specify serviceid under the corresponding region'
			)
		}

		const apigwHandler = []
		for (let i = 0; i < this.regionList.length; i++) {
			let tempInputs = JSON.parse(JSON.stringify(baseInputs)) // clone
			tempInputs.region = this.regionList[i]
			if (inputs[this.regionList[i]]) {
				tempInputs = this.mergeJson(inputs[this.regionList[i]], tempInputs)
			}
			apigwHandler.push(this.doDeploy(tempInputs, apigwOutputs))
		}

		await Promise.all(apigwHandler)
		return apigwOutputs

	}

	async remove(inputs = {}) {
		const apigwHandler = []
		for(let item in inputs){
			apigwHandler.push(this.doDelete(inputs[item],item))
		}
		await Promise.all(apigwHandler)
		return {}
	}
}

// don't forget to export the new Componnet you created!
module.exports = TencentAPIGWMultiRegion
