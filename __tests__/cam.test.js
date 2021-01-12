const { Cam } = require('../build');

describe('Cam', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const roleName = 'role-test';
  const policy = JSON.stringify({
    version: '2.0',
    statement: [
      {
        action: 'name/sts:AssumeRole',
        effect: 'allow',
        principal: {
          service: ['cloudaudit.cloud.tencent.com', 'cls.cloud.tencent.com'],
        },
      },
    ],
  });
  const cam = new Cam(credentials, process.env.REGION);

  test('should create role success', async () => {
    await cam.CreateRole(roleName, policy);
    const { RoleInfo } = await cam.GetRole(roleName);
    const exist = await cam.isRoleExist(roleName, {});
    expect(RoleInfo.RoleName).toBe(roleName);
    expect(exist).toBe(true);
  });

  test('should delete role success', async () => {
    await cam.DeleteRole(roleName, {});
    try {
      await cam.GetRole(roleName);
    } catch (e) {
      expect(e.code).toBe('InvalidParameter.RoleNotExist');
    }
  });

  test('SCFExcuteRole should exist', async () => {
    const res = await cam.CheckSCFExcuteRole();
    expect(res).toBe(true);
  });
});
