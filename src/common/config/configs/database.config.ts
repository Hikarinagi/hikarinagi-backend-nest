export default () => ({
  database: {
    uri: process.env.MONGO_URI,
    backup: {
      enable: process.env.DATABASE_BACKUP_ENABLE === 'true',
      retention: parseInt(process.env.DATABASE_BACKUP_RETENTION ?? '0', 10) || 0,
      uri: process.env.DATABASE_BACKUP_URI,
    },
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'hikarinagi',
    database: process.env.REDIS_DB || 0,
  },
})
