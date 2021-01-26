export interface CFSDeployInputs {
  zone: string;
  region: string;
  fsName: string;
  pGroupId?: string;
  netInterface: string;
  protocol?: string;
  storageType?: string;
  fileSystemId?: string;
  fsLimit?: number;
  vpc: {
    vpcId: string;
    subnetId: string;
    mountIP?: string;
  };
  tags?: { key: string; value: string }[];
}

export interface CFSDeployOutputs {
  region: string;
  fsName: string;
  pGroupId?: string;
  netInterface: string;
  protocol: string;
  storageType: string;
  fileSystemId?: string;
  tags?: { key: string; value?: string }[];
}

export interface CFSRemoveInputs {
  fsName: string;
  fileSystemId: string;
}

export interface CFSRemoveOutputs {}
