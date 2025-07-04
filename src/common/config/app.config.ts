export default () => ({
  port: parseInt(process.env.PORT || '3005', 10),
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '10', 10),
  },
  email: {
    elasticEmailApiKey: process.env.ELASTIC_EMAIL_API_KEY,
  },
  reader: {
    readerSignatureSecret: process.env.READER_SIGNATURE_SECRET,
  },
  galDownload: {
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
})
