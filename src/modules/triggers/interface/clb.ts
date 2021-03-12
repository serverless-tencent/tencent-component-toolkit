export interface ClbTriggerInputsParams {
  loadBalanceId: string;
  port: number;
  protocol: string;
  domain: string;
  url: string;
  qualifier?: string;
  enable?: boolean;
  weight?: number;
}

export interface CreateClbTriggerOutput {
  loadBalanceId: string;
  listenerId: string;
  locationId: string;
  port: number;
  protocol: string;
  domain: string;
  url: string;
  functionName: string;
  namespace: string;
  qualifier?: string;
  enable?: boolean;
  weight?: number;
}
