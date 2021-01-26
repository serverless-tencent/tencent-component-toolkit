export interface CnsRecordInputs {
  value: string;
  domain?: string;
  subDomain: string;
  recordLine: string;
  recordType: 'CNAME' | 'A' | 'AAAA' | 'TXT' | string;
  recordId?: string;
  mx?: number;
  ttl?: number;
  status?: string;
}

export interface CnsRecordOutputs {
  value: string;
  name: string;
  type: string;
  id: string;
  mx?: number;
  ttl?: number;
  line: string;

  status?: string;

  recordId: string;
}

export interface CnsSubDomain {
  subDomain: string;
  recordType: string;
}

export interface CnsDeployInputs {
  domain: string;
  item: {
    name: string;
    type: string;
    id: string;
    mx: string;
    ttl: string;
    line: string;
    status: string;
  };
  records: CnsRecordInputs[];
}

export interface CnsDeployOutputs {
  records: CnsRecordInputs[];
}
