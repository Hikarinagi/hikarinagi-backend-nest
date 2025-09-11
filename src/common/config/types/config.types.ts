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
    keyPrefix?: string
    database?: number
  }
}

export interface AppConfig {
  port: number
  siteBaseUrl: string
  enableIndexNow: boolean
  indexNowApiKey: string
  throttle: {
    ttl: number
    limit: number
  }
  email: {
    emailProvider?: 'elastic' | 'postal'
    emailApiKey?: string
    emailEndPoint?: string
    emailSenderAddress?: string
    emailSenderName?: string
  }
  allowRegister: boolean
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
  version: {
    major: number
    minor: number
    suffix: string
  }
}

// 合并所有配置类型
export interface AppConfigType extends AuthConfig, DatabaseConfig, AppConfig {}

type IsRecord<T> = T extends object
  ? T extends (...args: unknown[]) => unknown
    ? false
    : T extends readonly unknown[]
      ? false
      : true
  : false

type LeafPaths<T, P extends string = ''> = {
  [K in keyof T & string]: IsRecord<T[K]> extends true ? LeafPaths<T[K], `${P}${K}.`> : `${P}${K}`
}[keyof T & string]

type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never

export type ConfigPath = LeafPaths<AppConfigType>
export type ConfigPathValue<T extends ConfigPath> = PathValue<AppConfigType, T>
