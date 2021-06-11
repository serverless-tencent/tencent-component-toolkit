import { ApiError } from './../../utils/error';
import { ActionType } from './apis';
import { CapiCredentials, RegionType, ApiServiceType } from '../interface';
import { Capi } from '@tencent-sdk/capi';
import APIS from './apis';
import {
  GetPersonalImageTagDetailOptions,
  PersonalImageTagList,
  PersonalImageTagDetail,
  GetImageTagDetailOptions,
  GetImageTagDetailByNameOptions,
  RegistryItem,
  RegistryDetail,
  RepositoryItem,
  ImageTagItem,
} from './interface';

/** CAM （访问管理）for serverless */
export default class Cam {
  region: RegionType;
  credentials: CapiCredentials;
  capi: Capi;

  constructor(credentials: CapiCredentials, region: RegionType = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;

    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.tcr,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, data);
    return result;
  }

  // 获取个人版镜像详情，作为 SCF 代码配置
  async getPersonalImageInfo({
    namespace,
    repositoryName,
    tagName,
  }: GetPersonalImageTagDetailOptions) {
    const detail = await this.getPersonalTagDetail({
      namespace,
      repositoryName,
      tagName,
    });

    const imageUrl = `${detail.server}/${namespace}/${repositoryName}`;

    return {
      imageType: 'personal',
      imageUrl,
      imageUri: `${imageUrl}:${tagName}@${detail.tagId}`,
      tagName,
    };
  }

  /**
   * 获取企业版镜像详情，作为 SCF 代码配置，通过实例名称
   * @param options
   * @returns
   */
  async getImageInfoByName({
    registryName,
    namespace,
    repositoryName,
    tagName,
  }: GetImageTagDetailByNameOptions) {
    const registryDetail = await this.getRegistryDetailByName({
      registryName,
    });
    const tagDetail = await this.getImageTagDetail({
      registryId: registryDetail?.registryId!,
      namespace,
      repositoryName,
      tagName,
    });

    const imageUrl = `${registryDetail?.publicDomain}/${namespace}/${repositoryName}`;

    return {
      registryId: registryDetail?.registryId,
      registryName,
      imageType: 'enterprise',
      imageUrl,
      imageUri: `${imageUrl}:${tagName}@${tagDetail?.digest}`,
      tagName,
    };
  }

  /**
   * 获取企业版镜像详情,通过实例 ID
   * @param options 参数
   * @returns
   */
  async getImageInfo({ registryId, namespace, repositoryName, tagName }: GetImageTagDetailOptions) {
    const registryDetail = await this.getRegistryDetail({
      registryId,
    });
    if (!registryDetail) {
      throw new ApiError({
        type: 'API_TCR_getImageInfo',
        message: `[TCR] 找不到指定实例ID：${registryId}`,
      });
    }

    const tagDetail = await this.getImageTagDetail({
      registryId,
      namespace,
      repositoryName,
      tagName,
    });

    if (!tagDetail) {
      throw new ApiError({
        type: 'API_TCR_getImageInfo',
        message: `[TCR] 找不到指定镜像版本：${tagName}`,
      });
    }

    const imageUrl = `${registryDetail?.publicDomain}/${namespace}/${repositoryName}`;

    return {
      registryId,
      registryName: registryDetail.registryName,
      imageType: 'enterprise',
      imageUrl,
      imageUri: `${imageUrl}:${tagName}@${tagDetail?.digest}`,
      tagName,
    };
  }

  /**
   * 获取个人版镜像版本详情
   * @returns 镜像版本详情
   */
  async getPersonalTagDetail({
    namespace,
    repositoryName,
    tagName,
  }: GetPersonalImageTagDetailOptions): Promise<PersonalImageTagDetail> {
    const { Data } = (await this.request({
      Action: 'DescribeImagePersonal',
      RepoName: `${namespace}/${repositoryName}`,
      Tag: tagName,
    })) as { Data: PersonalImageTagList };
    const [tagInfo] = Data.TagInfo;
    if (!tagInfo) {
      throw new ApiError({
        type: 'API_TCR_getTagDetail',
        message: `[TCR] 找不到指定的镜像版本，命名空间：${namespace}，仓库名称：${repositoryName}，镜像版本：${tagName}`,
      });
    }

    return {
      namespace,
      repositoryName,
      server: Data.Server,
      tagName: tagInfo.TagName,
      tagId: tagInfo.TagId,
      imageId: tagInfo.ImageId,
      author: tagInfo.Author,
      os: tagInfo.OS,
    };
  }

  // 获得实例详情
  async getRegistryDetail({ registryId }: { registryId: string }): Promise<null | RegistryDetail> {
    const { Registries = [] }: { Registries: RegistryItem[] } = await this.request({
      Action: 'DescribeInstances',
      Registryids: [registryId],
    });
    const [detail] = Registries;
    if (detail) {
      return {
        registryId,
        registryName: detail.RegistryName,
        regionName: detail.RegionName,
        status: detail.Status,
        registryType: detail.RegistryType,
        publicDomain: detail.PublicDomain,
        internalEndpoint: detail.InternalEndpoint,
      };
    }
    return null;
  }

  async getRegistryDetailByName({ registryName }: { registryName: string }) {
    const { Registries = [] }: { Registries: RegistryItem[] } = await this.request({
      Action: 'DescribeInstances',
      Filters: [
        {
          Name: 'RegistryName',
          Values: [registryName],
        },
      ],
    });
    const [detail] = Registries;
    if (detail) {
      return {
        registryId: detail.RegistryId,
        registryName: detail.RegistryName,
        regionName: detail.RegionName,
        status: detail.Status,
        registryType: detail.RegistryType,
        publicDomain: detail.PublicDomain,
        internalEndpoint: detail.InternalEndpoint,
      };
    }
    return null;
  }

  // 获得仓库详情
  async getRepositoryDetail({
    registryId,
    namespace,
    repositoryName,
  }: Omit<GetImageTagDetailOptions, 'tagName'>) {
    const { RepositoryList = [] }: { RepositoryList: RepositoryItem[] } = await this.request({
      Action: 'DescribeRepositories',
      RegistryId: registryId,
      NamespaceName: namespace,
      RepositoryName: repositoryName,
    });
    const [detail] = RepositoryList;
    if (detail) {
      return {
        name: detail.Name,
        namespace: detail.Namespace,
        creationTime: detail.CreationTime,
        updateTime: detail.UpdateTime,
        public: detail.Public,
        description: detail.Description,
        briefDescription: detail.BriefDescription,
      };
    }
    return null;
  }

  // 获取指定版本的镜像详情
  async getImageTagDetail({
    registryId,
    namespace,
    repositoryName,
    tagName,
  }: GetImageTagDetailOptions) {
    const { ImageInfoList = [] }: { ImageInfoList: ImageTagItem[] } = await this.request({
      Action: 'DescribeImages',
      RegistryId: registryId,
      NamespaceName: namespace,
      RepositoryName: repositoryName,
      ImageVersion: tagName,
    });

    const [detail] = ImageInfoList;
    if (detail) {
      return {
        digest: detail.Digest,
        imageVersion: detail.ImageVersion,
        size: detail.Size,
        updateTime: detail.UpdateTime,
      };
    }
    return null;
  }
}
