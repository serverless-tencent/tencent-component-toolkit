export interface RecordInputs {
    value: string;
    domain: string;
    subDomain: string;
    recordLine: string;
    recordType: 'CNAME' | 'A' | 'AAAA' | 'TXT' | string;
    recordId: string;
    mx?: string;
    ttl?: number;
    status?: string;
}

export interface RecordOutputs {
    value: string;
    name: string;
    type: string;
    id: string,
    mx?: string;
    ttl?: number,
    line: string;

    status?: string;

    recordId: string;
}

export interface subDomain {
    subDomain: string,
    recordType: string,

}

export interface CnsDeployInputs {
    domain: string,
    item: {
        name: string,
        type: string,
        id: string,
        mx: string,
        ttl: string,
        line: string,
        status: string,
    },
    records: RecordInputs[],
}

export interface CnsDeployOutputs {
    records: RecordInputs[]
}