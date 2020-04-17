const { Capi } = require('@tencent-sdk/capi')
const utils = require('./utils')

class Vpc {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou'
    this.credentials = credentials
    this.capi = new Capi({
      Region: region,
      AppId: credentials.AppId,
      SecretId: credentials.SecretId,
      SecretKey: credentials.SecretKey,
      Token: credentials.Token
    })
  }

  async deploy(inputs) {
    const {
      zone,
      vpcName,
      subnetName,
      cidrBlock,
      enableMulticast,
      dnsServers,
      domainName,
      tags,
      subnetTags,
      enableSubnetBroadcast
    } = inputs

    let { vpcId, subnetId } = inputs

    const handleVpc = async (vId) => {
      let existVpc = false
      if (vId) {
        const detail = await utils.getVpcDetail(this.capi, vId)
        if (detail) {
          existVpc = true
        }
      }
      const params = {
        VpcName: vpcName
      }
      if (enableMulticast) {
        params.EnableMulticast = enableMulticast
      }
      if (dnsServers) {
        params.DnsServers = dnsServers
      }
      if (domainName) {
        params.DomainName = domainName
      }
      if (existVpc) {
        console.log(`Updating vpc ${vId}...`)
        params.VpcId = vId
        await utils.modifyVpc(this.capi, params)
        console.log(`Update vpc ${vId} success`)
      } else {
        if (!cidrBlock) {
          throw new Error('cidrBlock is required')
        }
        params.CidrBlock = cidrBlock
        if (tags) {
          params.Tags = tags
        }
        console.log(`Creating vpc ${vpcName}...`)
        const res = await utils.createVpc(this.capi, params)
        console.log(`Create vpc ${vpcName} success.`)
        vId = res.VpcId
      }
      return vId
    }

    // check subnetId
    const handleSubnet = async (vId, sId) => {
      let existSubnet = false
      if (sId) {
        const detail = await utils.getSubnetDetail(this.capi, sId)
        if (detail) {
          existSubnet = true
        }
      }
      const params = {
        SubnetName: subnetName
      }
      if (existSubnet) {
        console.log(`Updating subnet ${sId}...`)
        params.SubnetId = sId

        if (enableSubnetBroadcast !== undefined) {
          params.EnableBroadcast = enableSubnetBroadcast
        }
        await utils.modifySubnet(this.capi, params)
        console.log(`Update subnet ${sId} success.`)
      } else {
        if (vId) {
          console.log(`Creating subnet ${subnetName}...`)
          params.Zone = zone
          params.VpcId = vId
          params.CidrBlock = cidrBlock
          if (subnetTags) {
            params.Tags = subnetTags
          }

          const res = await utils.createSubnet(this.capi, params)
          console.log('handleSubnet', res)

          sId = res.SubnetId

          if (enableSubnetBroadcast === true) {
            await utils.modifySubnet(this.capi, {
              SubnetId: sId,
              EnableBroadcast: enableSubnetBroadcast
            })
          }
          console.log(`Create subnet ${subnetName} success.`)
        }
      }
      return sId
    }

    if (vpcName) {
      vpcId = await handleVpc(vpcId)
    }

    if (subnetName) {
      subnetId = await handleSubnet(vpcId, subnetId)
    }

    return {
      region: this.region,
      zone,
      vpcId,
      vpcName,
      subnetId,
      subnetName
    }
  }

  async remove(inputs) {
    const { vpcId, subnetId } = inputs
    if (subnetId) {
      console.log(`Start removing subnet ${subnetId}`)
      await utils.deleteSubnet(this.capi, subnetId)
      console.log(`Removed subnet ${subnetId}`)
    }
    if (vpcId) {
      console.log(`Start removing vpc ${vpcId}`)
      await utils.deleteVpc(this.capi, vpcId)
      console.log(`Removed vpc ${vpcId}`)
    }

    return {}
  }
}

module.exports = Vpc
