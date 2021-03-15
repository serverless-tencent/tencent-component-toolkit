export interface ClbRule {
  ListenerId: string;
  LocationId: string;
  Domain: string;
  Url: string;
  Certificate: null;
  HealthCheck: Record<string, any>;
  RewriteTarget?: {
    TargetListenerId: null;
    TargetLocationId: null;
  };
  SessionExpireTime: number;
  Scheduler: any;
  HttpGzip: boolean;
  BeAutoCreated: boolean;
  DefaultServer: boolean;
  Http2: boolean;
  ForwardType: string;
}
export interface ClbListener {
  ListenerId: string;
  ListenerName: string;
  Protocol: 'HTTPS' | 'HTTP';
  Port: number;
  HealthCheck: any;
  Certificate?: {
    SSLMode: string;
    CertId: string;
    CertCaId: string;
  };
  Scheduler: any;
  SessionExpireTime: number;
  SniSwitch: number;
  Rules: ClbRule[];
}

export interface CreateRuleInput {
  loadBalanceId: string;
  protocol: string;
  port: number;
  domain: string;
  url: string;
}

export interface CreateRuleOutput {
  loadBalanceId: string;
  listenerId: string;
  locationId: string;
  protocol: string;
  port: number;
  domain: string;
  url: string;
}

export interface BindClbTriggerInput {
  loadBalanceId: string;
  listenerId: string;
  locationId: string;
  functionName: string;
  namespace?: string;
  qualifier?: string;
  weight?: number;
}

export interface DeleteRuleInput {
  loadBalanceId: string;
  listenerId: string;
  locationId?: string;
  domain?: string;
  url?: string;
}
