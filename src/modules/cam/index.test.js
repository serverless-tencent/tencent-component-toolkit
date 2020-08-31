const Client = require('./index');

class ClientTest {
  async run() {
    const client = new Client({
      SecretId: '',
      SecretKey: '',
    });
    const roleName = 'role-test';
    // 1. create role
    const res1 = await client.CreateRole(
      roleName,
      JSON.stringify({
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
      }),
    );
    console.log('create result: ', JSON.stringify(res1));
    console.log('++++++++');

    // 2. get role
    const res2 = await client.GetRole(roleName);
    console.log('get result: ', res2);
    console.log('++++++++');

    const res3 = await client.isRoleExist(roleName, {});
    console.log('isRoleExist result: ', res3);
    console.log('++++++++');

    const res4 = await client.DeleteRole(roleName, {});
    console.log('delete result: ', res4);
    console.log('++++++++');

    const res5 = await client.CheckSCFExcuteRole();
    console.log('check SCFExcuteRole exist: ', res5);
  }
}

new ClientTest().run();

process.on('unhandledRejection', (e) => {
  throw e;
});
