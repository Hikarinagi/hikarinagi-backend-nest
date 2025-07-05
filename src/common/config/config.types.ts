export interface AuthConfig {
  jwt: {
    secret: string
    refreshSecret: string
    hikariAccessTokenExpiresIn: string
    hikariRefreshTokenExpiresIn: string
  }
}

export interface DatabaseConfig {
  database: {
    uri: string
  }
  redis: {
    host: string
    port: number
    password?: string
  }
}

export interface AppConfig {
  port: number
  throttle: {
    ttl: number
    limit: number
  }
  email: {
    elasticEmailApiKey?: string
  }
  reader: {
    readerSignatureSecret?: string
  }
  galDownload: {
    downloadSignatureSecret?: string
  }
  r2: {
    r2Endpoint?: string
    novel: {
      r2LightNovelAccessKey?: string
      r2LightNovelSecretKey?: string
      r2LightNovelBucket?: string
    }
    images: {
      r2ImageAccessKey?: string
      r2ImageSecretKey?: string
      r2ImageBucket?: string
    }
  }
  bangumi: {
    clientId?: string
    clientSecret?: string
  }
}

// 合并所有配置类型
export interface AppConfigType extends AuthConfig, DatabaseConfig, AppConfig {}

// 配置路径类型，用于 ConfigService.get() 方法的类型提示
export type ConfigPath =
  // JWT 配置
  | 'jwt.secret'
  | 'jwt.refreshSecret'
  | 'jwt.hikariAccessTokenExpiresIn'
  | 'jwt.hikariRefreshTokenExpiresIn'
  // 数据库配置
  | 'database.uri'
  // Redis 配置
  | 'redis.host'
  | 'redis.port'
  | 'redis.password'
  // 应用配置
  | 'port'
  | 'throttle.ttl'
  | 'throttle.limit'
  // 邮件配置
  | 'email.elasticEmailApiKey'
  // 阅读器配置
  | 'reader.readerSignatureSecret'
  // 下载配置
  | 'galDownload.downloadSignatureSecret'
  // R2 配置
  | 'r2.r2Endpoint'
  | 'r2.novel.r2LightNovelAccessKey'
  | 'r2.novel.r2LightNovelSecretKey'
  | 'r2.novel.r2LightNovelBucket'
  | 'r2.images.r2ImageAccessKey'
  | 'r2.images.r2ImageSecretKey'
  | 'r2.images.r2ImageBucket'
  // Bangumi 配置
  | 'bangumi.clientId'
  | 'bangumi.clientSecret'

// 根据配置路径获取对应的类型
export type ConfigPathValue<T extends ConfigPath> = T extends 'jwt.secret'
  ? string
  : T extends 'jwt.refreshSecret'
    ? string
    : T extends 'jwt.hikariAccessTokenExpiresIn'
      ? string
      : T extends 'jwt.hikariRefreshTokenExpiresIn'
        ? string
        : T extends 'database.uri'
          ? string
          : T extends 'redis.host'
            ? string
            : T extends 'redis.port'
              ? number
              : T extends 'redis.password'
                ? string | undefined
                : T extends 'port'
                  ? number
                  : T extends 'throttle.ttl'
                    ? number
                    : T extends 'throttle.limit'
                      ? number
                      : T extends 'email.elasticEmailApiKey'
                        ? string | undefined
                        : T extends 'reader.readerSignatureSecret'
                          ? string | undefined
                          : T extends 'galDownload.downloadSignatureSecret'
                            ? string | undefined
                            : T extends 'r2.r2Endpoint'
                              ? string | undefined
                              : T extends 'r2.novel.r2LightNovelAccessKey'
                                ? string | undefined
                                : T extends 'r2.novel.r2LightNovelSecretKey'
                                  ? string | undefined
                                  : T extends 'r2.novel.r2LightNovelBucket'
                                    ? string | undefined
                                    : T extends 'r2.images.r2ImageAccessKey'
                                      ? string | undefined
                                      : T extends 'r2.images.r2ImageSecretKey'
                                        ? string | undefined
                                        : T extends 'r2.images.r2ImageBucket'
                                          ? string | undefined
                                          : T extends 'bangumi.clientId'
                                            ? string | undefined
                                            : T extends 'bangumi.clientSecret'
                                              ? string | undefined
                                              : never
