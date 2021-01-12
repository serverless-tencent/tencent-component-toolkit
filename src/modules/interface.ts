export enum ServiceType {
    /** API 网关服务 (apigateway) */
    apigateway= 'apigateway',
    /** 云函数服务 (SCF) */
    scf='scf',
    /** 视频处理服务 (MPS) */
    mps='mps',
    /** 资源标签服务 (TAG) */
    tag='tag',
    /** 内容分发 (CDN) */
    cdn='cdn',
    /** 文件存储 (CFS) */
    cfs='cfs',
    /** 域名解析服务 (CNS) */
    cns='cns',
    /**  */
    domain='domain',
    /** MySQL 数据库 (CynosDB) */
    cynosdb='cynosdb',
    /** Postgres 数据库 (Postgres) */
    postgres='postgres',
    /** (VPC) */
    vpc='vpc',
}


export const enum RegionType {
    'ap-guangzhou'='ap-guangzhou',
}

export interface CapiCredentials {
    AppId?: string;
    SecretId?: string;
    SecretKey?: string;
    Token?: string;

    token?: string;
    XCosSecurityToken?: string;
}