const { Capi } = require('@tencent-sdk/capi');
const Apis = require('./apis');

class Cam {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      AppId: this.credentials.AppId,
      SecretId: this.credentials.SecretId,
      SecretKey: this.credentials.SecretKey,
      Token: this.credentials.Token,
    });
  }

  async request({ Action, ...data }) {
    const result = await Apis[Action](this.capi, data);
    return result;
  }

  async DescribeRoleList(page, limit) {
    const reqParams = {
      Action: 'DescribeRoleList',
      Page: page,
      Rp: limit,
    };
    return this.request(reqParams);
  }

  async ListRolePoliciesByRoleId(roleId, page, limit) {
    const reqParams = {
      Action: 'ListAttachedRolePolicies',
      Page: page,
      Rp: limit,
      RoleId: roleId,
    };
    return this.request(reqParams);
  }

  async CreateRole(roleName, policiesDocument) {
    const reqParams = {
      Action: 'CreateRole',
      RoleName: roleName,
      PolicyDocument: policiesDocument,
      Description: 'Created By Serverless Framework',
    };
    return this.request(reqParams);
  }

  async GetRole(roleName) {
    return this.request({
      Action: 'GetRole',
      RoleName: roleName,
    });
  }

  async DeleteRole(roleName) {
    return this.request({
      Action: 'DeleteRole',
      RoleName: roleName,
    });
  }

  // api limit qps 3/s
  async AttachRolePolicyByName(roleId, policyName) {
    const reqParams = {
      Action: 'AttachRolePolicy',
      AttachRoleId: roleId,
      PolicyName: policyName,
    };
    return this.request(reqParams);
  }

  async isRoleExist(roleName) {
    const { List = [] } = await this.DescribeRoleList(1, 200);

    for (var i = 0; i < List.length; i++) {
      const roleItem = List[i];

      if (roleItem.RoleName === roleName) {
        return true;
      }
    }
    return false;
  }

  async CheckSCFExcuteRole() {
    return this.isRoleExist('QCS_SCFExcuteRole');
  }
}

module.exports = Cam;
