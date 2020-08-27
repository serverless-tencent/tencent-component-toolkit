const { cam } = require('tencent-cloud-sdk');
const { ApiError } = require('../../utils/error');

class Cam {
  constructor(credentials = {}, region) {
    this.region = region || 'ap-guangzhou';
    this.credentials = credentials;
    this.camClient = new cam(this.credentials);
  }

  async request(data) {
    try {
      const res = await this.camClient.request(data);

      if (res.Response && res.Response.Error) {
        throw new ApiError({
          type: `API_CAM_${data.action}`,
          message: `${res.Response.Error.Message} (reqId: ${res.Response.RequestId})`,
          reqId: res.Response.RequestId,
          code: res.Response.Error.Code,
        });
      }
      return res;
    } catch (e) {
      throw new ApiError({
        type: `API_CAM_${data.action}`,
        message: e.message,
        stack: e.stack,
        reqId: e.reqId,
        code: e.code,
      });
    }
  }

  async DescribeRoleList(page, limit) {
    const reqParams = {
      Action: 'DescribeRoleList',
      Version: '2019-01-16',
      Page: page,
      Rp: limit,
    };
    return this.request(reqParams);
  }

  async ListRolePoliciesByRoleId(roleId, page, limit) {
    const reqParams = {
      Action: 'ListAttachedRolePolicies',
      Version: '2019-01-16',
      Page: page,
      Rp: limit,
      RoleId: roleId,
    };
    return this.request(reqParams);
  }

  async CreateRole(roleName, policiesDocument) {
    const reqParams = {
      Action: 'CreateRole',
      Version: '2019-01-16',
      RoleName: roleName,
      PolicyDocument: policiesDocument,
      Description: 'Serverless Framework',
    };
    return this.request(reqParams);
  }

  // api limit qps 3/s
  async AttachRolePolicyByName(roleId, policyName) {
    const reqParams = {
      Action: 'AttachRolePolicy',
      Version: '2019-01-16',
      AttachRoleId: roleId,
      PolicyName: policyName,
    };
    return this.request(reqParams);
  }

  async CheckSCFExcuteRole() {
    const ScfExcuteRoleName = 'QCS_SCFExcuteRole';

    const roles = await this.DescribeRoleList(1, 200);

    const len = roles.Response.List.length;
    for (var i = 0; i < len; i++) {
      const roleItem = roles.Response.List[i];

      if (roleItem.RoleName == ScfExcuteRoleName) {
        return true;
      }
    }
    return false;
  }
}

module.exports = Cam;
