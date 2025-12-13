export default () => ({
  port: parseInt(process.env.PORT || '3005', 10),
  siteBaseUrl: process.env.SITE_BASE_URL || 'https://www.hikarinagi.org',
  enableIndexNow: process.env.ENABLE_INDEX_NOW === 'true',
  indexNowApiKey: process.env.INDEX_NOW_API_KEY,
  indexNowSchedule: process.env.INDEX_NOW_SCHEDULE || '0 0 0/1 * * *',

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '10', 10),
  },
  email: {
    emailProvider: process.env.EMAIL_PROVIDER || 'elastic',
    emailApiKey: process.env.EMAIL_PROVIDER_API_KEY,
    emailEndPoint: process.env.EMAIL_PROVIDER_ENDPOINT,
    emailSenderAddress: process.env.EMAIL_SENDER_ADDRESS,
    emailSenderName: process.env.EMAIL_SENDER_NAME,
  },
  allowRegister: process.env.ALLOW_REGISTER === 'true',
  reader: {
    readerSignatureSecret: process.env.READER_SIGNATURE_SECRET,
  },
  galDownload: {
    downloadSignatureSecret: process.env.DOWNLOAD_SIGNATURE_SECRET,
  },
  novelDownload: {
    downloadSignatureSecret: process.env.DOWNLOAD_SIGNATURE_SECRET,
  },
  r2: {
    r2Endpoint: process.env.R2_ENDPOINT,
    novel: {
      r2LightNovelAccessKey: process.env.R2_LIGHTNOVEL_ACCESS_KEY,
      r2LightNovelSecretKey: process.env.R2_LIGHTNOVEL_SECRET_KEY,
      r2LightNovelBucket: process.env.R2_LIGHTNOVEL_BUCKET,
    },
    images: {
      r2ImageAccessKey: process.env.R2_IMAGE_ACCESS_KEY,
      r2ImageSecretKey: process.env.R2_IMAGE_SECRET_KEY,
      r2ImageBucket: process.env.R2_IMAGE_BUCKET,
    },
  },
  bangumi: {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  },
  s3: {
    backup: {
      region: process.env.S3_BACKUP_REGION,
      endpoint: process.env.S3_BACKUP_ENDPOINT,
      bucket: process.env.S3_BACKUP_BUCKET,
      accessKeyId: process.env.S3_BACKUP_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_BACKUP_SECRET_ACCESS_KEY,
    },
  },
  version: {
    major: parseInt(process.env.VERSION_MAJOR || '2', 10),
    minor: parseInt(process.env.VERSION_MINOR || '0', 10),
    suffix: process.env.VERSION_SUFFIX || 'alpha',
  },
})
