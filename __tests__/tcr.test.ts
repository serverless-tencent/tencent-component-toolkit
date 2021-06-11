import { Tcr } from '../src';

describe('Tcr', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  // const client = new Tcr(credentials, process.env.REGION);
  const client = new Tcr(credentials, 'ap-chengdu');

  describe('Personal', () => {
    const namespace = 'sls-scf';
    const repositoryName = 'nodejs_test';
    const tagName = 'latest';

    test('get personal image info', async () => {
      const res = await client.getPersonalImageInfo({ namespace, repositoryName, tagName });
      expect(res).toEqual({
        imageType: 'personal',
        imageUrl: `ccr.ccs.tencentyun.com/${namespace}/${repositoryName}`,
        imageUri: expect.stringContaining(
          `ccr.ccs.tencentyun.com/${namespace}/${repositoryName}:${tagName}@`,
        ),
        tagName,
      });
    });

    test('getPersonalTagDetail', async () => {
      const res = await client.getPersonalTagDetail({ namespace, repositoryName, tagName });
      expect(res).toEqual({
        repositoryName,
        namespace,
        tagName,
        server: 'ccr.ccs.tencentyun.com',
        tagId: expect.stringContaining('sha256:'),
        imageId: expect.stringContaining('sha256:'),
        author: expect.any(String),
        os: expect.any(String),
      });
    });
  });

  describe('Enterprise', () => {
    const registryName = 'serverless';
    const registryId = 'tcr-l03rz3ld';
    const namespace = 'enterprise';
    const repositoryName = 'nodejs_test';
    const tagName = 'latest';

    test('get enterprise image info', async () => {
      const res = await client.getImageInfo({
        registryId,
        namespace,
        repositoryName,
        tagName,
      });
      expect(res).toEqual({
        imageType: 'enterprise',
        imageUrl: `${registryName}.tencentcloudcr.com/${namespace}/${repositoryName}`,
        imageUri: expect.stringContaining(
          `${registryName}.tencentcloudcr.com/${namespace}/${repositoryName}:${tagName}@`,
        ),
        tagName,
      });
    });

    test('get enterprise image info by name', async () => {
      const res = await client.getImageInfoByName({
        registryName,
        namespace,
        repositoryName,
        tagName,
      });
      expect(res).toEqual({
        imageType: 'enterprise',
        imageUrl: `${registryName}.tencentcloudcr.com/${namespace}/${repositoryName}`,
        imageUri: expect.stringContaining(
          `${registryName}.tencentcloudcr.com/${namespace}/${repositoryName}:${tagName}@`,
        ),
        tagName,
      });
    });

    test('getRegistryDetail', async () => {
      const res = await client.getRegistryDetail({
        registryId,
      });
      expect(res).toEqual({
        registryId,
        registryName,
        regionName: expect.any(String),
        status: 'Running',
        registryType: 'basic',
        publicDomain: `${registryName}.tencentcloudcr.com`,
        internalEndpoint: expect.any(String),
      });
    });

    test('getRegistryDetailByName', async () => {
      const res = await client.getRegistryDetailByName({
        registryName: 'serverless',
      });
      expect(res).toEqual({
        registryId,
        registryName,
        regionName: expect.any(String),
        status: 'Running',
        registryType: 'basic',
        publicDomain: `${registryName}.tencentcloudcr.com`,
        internalEndpoint: expect.any(String),
      });
    });

    test('getRepositoryDetail', async () => {
      const res = await client.getRepositoryDetail({
        registryId,
        namespace,
        repositoryName,
      });
      expect(res).toEqual({
        name: `${namespace}/${repositoryName}`,
        namespace,
        creationTime: expect.any(String),
        updateTime: expect.any(String),
        description: expect.any(String),
        briefDescription: expect.any(String),
        public: false,
      });
    });

    test('getImageTagDetail', async () => {
      const res = await client.getImageTagDetail({
        registryId,
        namespace,
        repositoryName,
        tagName: 'latest',
      });
      expect(res).toEqual({
        digest: expect.stringContaining('sha256:'),
        imageVersion: 'latest',
        size: expect.any(Number),
        updateTime: expect.any(String),
      });
    });
  });
});
