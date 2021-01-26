import { TagDeployInputs } from './../src/modules/tag/interface';
import { Tag } from '../src';
import { ApiServiceType } from '../src/modules/interface';

describe('Tag', () => {
  const credentials = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
  };
  const functionName = 'serverless-unit-test';
  const tagItem = { TagKey: 'slstest', TagValue: 'slstest' };
  const commonInputs: TagDeployInputs = {
    resourceIds: [`default/function/${functionName}`],
    resourcePrefix: 'namespace',
    serviceType: ApiServiceType.scf,
  };
  const tag = new Tag(credentials, process.env.REGION);

  test('attach tags', async () => {
    // delete commonInputs.addTags;
    commonInputs.attachTags = [tagItem];

    const res = await tag.deploy(commonInputs);
    const tagList = await tag.getScfResourceTags({
      functionName: functionName,
    });
    const [exist] = tagList.filter(
      (item) => item.TagKey === tagItem.TagKey && item.TagValue === tagItem.TagValue,
    );
    expect(res).toBe(true);
    expect(exist).toBeDefined();
  });

  test('detach tags', async () => {
    // delete commonInputs.addTags;
    delete commonInputs.attachTags;
    commonInputs.detachTags = [tagItem];

    const res = await tag.deploy(commonInputs);
    const tagList = await tag.getScfResourceTags({
      functionName: functionName,
    });
    const [exist] = tagList.filter(
      (item) => item.TagKey === tagItem.TagKey && item.TagValue === tagItem.TagValue,
    );
    expect(res).toBe(true);
    expect(exist).toBeUndefined();
  });

  test('delete tags', async () => {
    const res = await tag.deleteTags([tagItem]);

    const tagList = await tag.getTagList();
    const [exist] = tagList.filter(
      (item) => item.TagKey === tagItem.TagKey && item.TagValue === tagItem.TagValue,
    );
    expect(res).toBe(true);
    expect(exist).toBeUndefined();
  });
});
