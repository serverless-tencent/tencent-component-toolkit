const { cam } = require('tencent-cloud-sdk')

class Cam {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou'
    this.credentials = credentials
    this.camClient = new cam(this.credentials)
  }

  async sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  async DescribeRoleList(page, limit) {
    const reqParams = {
      Action: 'DescribeRoleList',
      Version: '2019-01-16',
      Page: page,
      Rp: limit
    }
    return await this.camClient.request(reqParams)
  }

  async ListRolePoliciesByRoleId(roleId, page, limit) {
    const reqParams = {
      Action: 'ListAttachedRolePolicies',
      Version: '2019-01-16',
      Page: page,
      Rp: limit,
      RoleId: roleId
    }
    return await this.camClient.request(reqParams)
  }

  async CreateRole(roleName, policiesDocument) {
    const reqParams = {
      Action: 'CreateRole',
      Version: '2019-01-16',
      RoleName: roleName,
      PolicyDocument: policiesDocument,
      Description: 'Serverless Framework'
    }
    return await this.camClient.request(reqParams)
  }

  // api limit qps 3/s
  async AttachRolePolicyByName(roleId, policyName) {
    const reqParams = {
      Action: 'AttachRolePolicy',
      Version: '2019-01-16',
      AttachRoleId: roleId,
      PolicyName: policyName
    }
    return await this.camClient.request(reqParams)
  }

  async CheckSCFExcuteRole() {
    const ScfExcuteRoleName = 'QCS_SCFExcuteRole'

    const roles = await this.DescribeRoleList(1, 200)
    if (roles.Response.Error) {
      throw new Error(roles.Response.Error.Message)
    }

    const len = roles.Response.List.length
    for (var i = 0; i < len; i++) {
      const roleItem = roles.Response.List[i]

      if (roleItem.RoleName == ScfExcuteRoleName) {
        return true
      }
    }
    return false
  }
}

module.exports = Cam
