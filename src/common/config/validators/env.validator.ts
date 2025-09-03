import { Logger } from '@nestjs/common'

interface EnvConfig {
  key: string
  required: boolean
  type: 'string' | 'number' | 'boolean'
  description: string
  defaultValue?: string | number | boolean
}

export class EnvironmentValidator {
  private static readonly logger = new Logger('EnvironmentValidator')

  private static readonly ENV_CONFIG: EnvConfig[] = [
    // base
    {
      key: 'NODE_ENV',
      required: false,
      type: 'string',
      description: '环境模式',
      defaultValue: 'development',
    },
    {
      key: 'SITE_BASE_URL',
      required: false,
      type: 'string',
      description: '网站域名',
      defaultValue: 'https://www.hikarinagi.org',
    },
    { key: 'INDEX_NOW_API_KEY', required: false, type: 'string', description: 'IndexNow API 密钥' },
    { key: 'PORT', required: false, type: 'number', description: '应用端口', defaultValue: 3005 },

    // database
    { key: 'MONGO_URI', required: true, type: 'string', description: 'MongoDB 连接字符串' },

    // redis
    { key: 'REDIS_HOST', required: true, type: 'string', description: 'Redis 主机地址' },
    {
      key: 'REDIS_PORT',
      required: true,
      type: 'number',
      description: 'Redis 端口',
      defaultValue: 6379,
    },
    { key: 'REDIS_PASSWORD', required: false, type: 'string', description: 'Redis 密码' },
    {
      key: 'REDIS_KEY_PREFIX',
      required: false,
      type: 'string',
      description: 'Redis 键前缀',
      defaultValue: 'hikarinagi',
    },
    {
      key: 'REDIS_DB',
      required: false,
      type: 'number',
      description: 'Redis 数据库',
      defaultValue: 0,
    },

    // JWT
    { key: 'JWT_SECRET', required: false, type: 'string', description: 'JWT 签名密钥' },
    { key: 'JWT_REFRESH_SECRET', required: false, type: 'string', description: 'JWT 刷新令牌密钥' },
    {
      key: 'HIKARI_ACCESS_TOKEN_EXPIRES_IN',
      required: false,
      type: 'string',
      description: '访问令牌过期时间',
      defaultValue: '1h',
    },
    {
      key: 'HIKARI_REFRESH_TOKEN_EXPIRES_IN',
      required: false,
      type: 'string',
      description: '刷新令牌过期时间',
      defaultValue: '7d',
    },

    // throttle
    {
      key: 'THROTTLE_TTL',
      required: false,
      type: 'number',
      description: '限流时间窗口',
      defaultValue: 60000, // 60s
    },
    {
      key: 'THROTTLE_LIMIT',
      required: false,
      type: 'number',
      description: '限流次数限制',
      defaultValue: 100, // 100次
    },

    // email
    {
      key: 'EMAIL_PROVIDER',
      required: false,
      type: 'string',
      description: '邮件提供商',
      defaultValue: 'elastic',
    },
    {
      key: 'EMAIL_PROVIDER_API_KEY',
      required: false,
      type: 'string',
      description: 'ElasticEmail API 密钥',
    },
    {
      key: 'EMAIL_PROVIDER_ENDPOINT',
      required: false,
      type: 'string',
      description: 'ElasticEmail API 端点',
    },
    { key: 'EMAIL_SENDER_ADDRESS', required: false, type: 'string', description: '发件人邮箱地址' },
    { key: 'EMAIL_SENDER_NAME', required: false, type: 'string', description: '发件人名称' },

    // feature
    {
      key: 'ALLOW_REGISTER',
      required: false,
      type: 'boolean',
      description: '是否允许注册',
      defaultValue: true,
    },

    // signature
    {
      key: 'READER_SIGNATURE_SECRET',
      required: false,
      type: 'string',
      description: '阅读器签名密钥',
    },
    {
      key: 'DOWNLOAD_SIGNATURE_SECRET',
      required: false,
      type: 'string',
      description: '下载签名密钥',
    },

    // r2
    { key: 'R2_ENDPOINT', required: false, type: 'string', description: 'Cloudflare R2 端点' },
    {
      key: 'R2_LIGHTNOVEL_ACCESS_KEY',
      required: false,
      type: 'string',
      description: 'R2 轻小说存储访问密钥',
    },
    {
      key: 'R2_LIGHTNOVEL_SECRET_KEY',
      required: false,
      type: 'string',
      description: 'R2 轻小说存储秘密密钥',
    },
    {
      key: 'R2_LIGHTNOVEL_BUCKET',
      required: false,
      type: 'string',
      description: 'R2 轻小说存储桶',
    },
    {
      key: 'R2_IMAGE_ACCESS_KEY',
      required: false,
      type: 'string',
      description: 'R2 图片存储访问密钥',
    },
    {
      key: 'R2_IMAGE_SECRET_KEY',
      required: false,
      type: 'string',
      description: 'R2 图片存储秘密密钥',
    },
    { key: 'R2_IMAGE_BUCKET', required: false, type: 'string', description: 'R2 图片存储桶' },

    // bangumi
    { key: 'CLIENT_ID', required: false, type: 'string', description: 'Bangumi 客户端 ID' },
    { key: 'CLIENT_SECRET', required: false, type: 'string', description: 'Bangumi 客户端密钥' },
  ]

  static validateEnvironment(): void {
    const errors: string[] = []
    const warnings: string[] = []

    // check required
    const missingRequired = this.ENV_CONFIG.filter(config => config.required).filter(
      config => !process.env[config.key] || process.env[config.key].trim() === '',
    )

    if (missingRequired.length > 0) {
      errors.push('缺少必需的环境变量:')
      missingRequired.forEach(config => {
        errors.push(`  ${config.key}: ${config.description}`)
      })
    }

    // check type and format
    for (const config of this.ENV_CONFIG) {
      const value = process.env[config.key]

      if (!value) {
        if (config.defaultValue !== undefined) {
          process.env[config.key] = String(config.defaultValue)
        } else if (!config.required) {
          warnings.push(`${config.key}: 未设置 (${config.description})`)
        }
        continue
      }

      // check type
      if (config.type === 'number' && isNaN(Number(value))) {
        errors.push(`${config.key}: 必须是数字，当前值: "${value}"`)
      } else if (config.type === 'boolean' && !['true', 'false'].includes(value.toLowerCase())) {
        errors.push(`${config.key}: 必须是 true 或 false，当前值: "${value}"`)
      }
    }

    // check special
    this.validateSpecialCases(errors, warnings)

    // print result
    this.printValidationResults(errors, warnings)

    if (errors.length > 0) {
      this.logger.error('请检查环境变量配置')
      process.exit(1)
    }
  }

  private static validateSpecialCases(errors: string[], warnings: string[]): void {
    // check jwt secret
    const jwtSecret = process.env.JWT_SECRET
    const refreshSecret = process.env.JWT_REFRESH_SECRET
    if (jwtSecret && jwtSecret.length < 32) {
      warnings.push('JWT_SECRET: 建议使用至少 32 位字符的强密钥')
    }
    if (refreshSecret && refreshSecret.length < 32) {
      warnings.push('JWT_REFRESH_SECRET: 建议使用至少 32 位字符的强密钥')
    }

    // check production
    if (process.env.NODE_ENV === 'production') {
      const productionChecks = [
        { key: 'JWT_SECRET', check: (v: string) => v.includes('your-super-secret') },
        { key: 'JWT_REFRESH_SECRET', check: (v: string) => v.includes('your-super-secret') },
      ]
      productionChecks.forEach(({ key, check }) => {
        const value = process.env[key]
        if (value && check(value)) {
          errors.push(`生产环境检查失败: ${key} 仍在使用默认值或不安全的配置`)
        }
      })
    }

    // check email
    const emailProvider = process.env.EMAIL_PROVIDER
    if (emailProvider !== 'elastic' && emailProvider !== 'postal') {
      errors.push('EMAIL_PROVIDER: 必须是 elastic 或 postal')
    }
    const emailKeys = ['EMAIL_PROVIDER_API_KEY', 'EMAIL_SENDER_ADDRESS']
    const hasAnyEmail = emailKeys.some(key => process.env[key])
    const hasAllEmail = emailKeys.every(key => process.env[key])
    if (hasAnyEmail && !hasAllEmail) {
      warnings.push('邮件配置不完整: 要启用邮件功能，请配置所有邮件相关环境变量')
    }

    // check r2
    const r2NovelKeys = [
      'R2_LIGHTNOVEL_ACCESS_KEY',
      'R2_LIGHTNOVEL_SECRET_KEY',
      'R2_LIGHTNOVEL_BUCKET',
    ]
    const r2ImageKeys = ['R2_IMAGE_ACCESS_KEY', 'R2_IMAGE_SECRET_KEY', 'R2_IMAGE_BUCKET']
    this.checkGroupCompleteness('R2 轻小说存储', r2NovelKeys, warnings)
    this.checkGroupCompleteness('R2 图片存储', r2ImageKeys, warnings)
  }

  private static checkGroupCompleteness(
    groupName: string,
    keys: string[],
    warnings: string[],
  ): void {
    const hasAny = keys.some(key => process.env[key])
    const hasAll = keys.every(key => process.env[key])

    if (hasAny && !hasAll) {
      warnings.push(
        `${groupName}配置不完整: 缺少 ${keys.filter(key => !process.env[key]).join(', ')}`,
      )
    }
  }

  private static printValidationResults(errors: string[], warnings: string[]): void {
    if (warnings.length > 0) {
      warnings.forEach(line => this.logger.warn(`${line}`))
    }

    if (errors.length > 0) {
      errors.forEach(line => this.logger.error(`${line}`))
    }
  }
}
