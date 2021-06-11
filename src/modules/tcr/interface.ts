export interface GetPersonalImageTagDetailOptions {
  namespace: string;
  repositoryName: string;
  tagName: string;
}

export interface GetImageTagDetailOptions {
  registryId: string;
  namespace: string;
  repositoryName: string;
  tagName: string;
}

export interface GetImageTagDetailByNameOptions {
  registryName: string;
  namespace: string;
  repositoryName: string;
  tagName: string;
}

export interface PersonalImageTagItem {
  Id: number;
  TagName: string;
  TagId: string;
  ImageId: string;
  Size: string;
  CreationTime: string;
  DurationDays: string;
  Author: string;
  Architecture: string;
  DockerVersion: string;
  OS: string;
  UpdateTime: string;
  PushTime: string;
  SizeByte: number;
}
export interface PersonalImageTagList {
  RepoName: string;
  Server: string;
  TagCount: number;
  TagInfo: PersonalImageTagItem[];
}

export interface PersonalImageTagDetail {
  namespace: string;
  repositoryName: string;
  server: string;
  tagName: string;
  tagId: string;
  imageId: string;
  author: string;
  os: string;
}

// 实例详情
export interface RegistryItem {
  RegistryId: string;
  RegistryName: string;
  Status: string;
  RegistryType: string;
  PublicDomain: string;
  InternalEndpoint: string;
  ExpiredAt: string;
  PayMod: number;
  RenewFlag: number;

  RegionId: number;
  RegionName: string;
  EnableAnonymous: boolean;
  TokenValidTime: number;
  CreatedAt: string;
  TagSpecification: { ResourceType: 'instance'; Tags: any[] };
}

export interface RegistryDetail {
  registryId: string;
  registryName: string;
  regionName: string;
  status: string;
  registryType: string;
  publicDomain: string;
  internalEndpoint: string;
}

// 仓库详情
export interface RepositoryItem {
  Name: string;
  Namespace: string;
  CreationTime: string;
  UpdateTime: string;
  Description: string;
  BriefDescription: string;
  Public: boolean;
}

// 镜像详情
export interface ImageTagItem {
  Digest: string;
  ImageVersion: string;
  Size: number;
  UpdateTime: string;
}
