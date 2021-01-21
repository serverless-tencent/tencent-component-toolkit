export interface CertInfo {
  certId?: string;
  certificate?: string;
  privateKey?: string;
  remarks?: string;
};

export interface DeployInputs {
  oldState?: any;

  /** 是否等待 CDN 部署完毕 */
  async?: boolean;

  /** 是否仅清空 CDN 缓存，不进行部署 */
  onlyRefresh?: boolean;

  /** CDN 域名 */
  domain: string;
  /** CDN 源站 */
  origin: {
    /** 源站列表 */
    origins: string[];
    originType: string;
    /** 回源协议 */
    originPullProtocol: string;
    serverName: string;
    /** 后备源站列表 */
    backupOrigins?: string[];
    /** 后备服务器名 */
    backupServerName?: string;
  };

  /** 加速类型：静态网站，大文件等 */
  serviceType?: 'web' | string;

  /** 是否启用 HTTPS */
  https?: {
    switch?: 'on' | 'off';
    http2?: 'on' | 'off';
    ocspStapling?: 'on' | 'off';
    verifyClient?: 'on' | 'off';
    certInfo: CertInfo;
  };

  /** 强制重定向 */
  forceRedirect?: {
    switch?: 'on' | 'off';
    redirectStatusCode: number;
    redirectType?: 'https';
  };

  /** 清空 CDN 缓存 */
  refreshCdn?: {
    /** 清空缓存 URL */
    urls: string[];

    flushType: string;
  };

  /** 进行预热刷新 */
  pushCdn?: {
    /** 预热 URL */
    urls: string[];
    /** 预热区域 */
    area: string;
    /** 预热时回源请求头 UserAgent */
    userAgent: string;
  };
}
